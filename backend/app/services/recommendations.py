"""충전소 추천 (POST /recommendations, UC-U06) - 마포 충전소 중 탭(지금 출발 · 15 · 30분 후 도착)별 Top 3

docs/api/user.md 3번
- 후보 제외 · 순위는 AI 추천 모듈 채점(run_recommendation.score_snapshot) 그대로 씀 (2026-11-22) - 모델 예측 근거
  후보가 먼저(점수 = 이동시간/30 + 예측 점유율), 예측이 없으면 최근 15분 관측 근거(참고 안내) 후보가 뒤에 옴
- 백엔드 몫(AI 계약의 backend 담당): 후보 고르기(마포 · 반경 15km · 가까운 20곳 · 사용자 조건) · 이동시간 ·
  충전소 중복 없이 Top 3 · 혼잡 제외 필터(그 탭 혼잡도, 우리 규칙) · 응답 문구
- 이동시간은 가까운 20곳, 3단계 (2026-11-22 결정, 캐시 없음): 카카오 다중 목적지 1회 → 자동차 길찾기 20곳 →
  직선거리 추정. 전체 3초 안에 못 받으면 경로 없이 넘김 → AI가 직선거리로 추정(2분 + 시속 24km)
"""

import json
import logging
import math
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, wait
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.collector.prediction import CONGESTIONS
from app.config import settings
from app.db.models import CollectionRun
from app.schemas.recommendation import (
    HorizonRecommendations,
    Recommendation,
    RecommendationFilters,
    RecommendationRequest,
    RecommendationsResponse,
    RecommendedStation,
)
from app.schemas.station import Station
from app.services import directions
from app.services.ai_ranking import TABS, AiPackageUnavailable, get_scorer
from app.services.directions import DirectionsQuotaExceeded
from app.services.predictions import load_raw_predictions, round_wait
from app.services.snapshot import ChargerState, latest_success_run, load_charger_states
from app.services.stations import MAPO, area_stations
from app.services.status import elapsed_quality

logger = logging.getLogger(__name__)

TOP_N = 3
CANDIDATE_LIMIT = 20  # Directions를 부르는 후보 수 (MAP-02) - AI 채점 함수도 20곳까지만 받음
RADIUS_KM = 15
# 이동시간을 기다리는 전체 시간 - 이 안에 못 받은 후보는 AI가 직선거리로 추정
DIRECTIONS_WAIT_SEC = 3
# 자동차 길찾기로 이어 쓸 때 남아 있어야 하는 시간 - 이보다 적으면 결과를 못 기다려 예산만 쓰므로 바로 추정
CAR_STAGE_MIN_SEC = 1
CONGESTION_ORDER = {"low": 0, "medium": 1, "high": 2}
CONGESTION_LABEL = {"low": "여유", "medium": "보통", "high": "혼잡"}
# AI 채점 결과의 근거 단계 → 응답 basis
FORECAST_SOURCES = ("model", "last_good_model")
BOUNDARY_PATH = Path(__file__).resolve().parents[2] / "data" / "mapo_boundary.json"

# 요청이 여럿 겹쳐도 Directions 동시 호출 수를 묶음
_executor = ThreadPoolExecutor(max_workers=CANDIDATE_LIMIT * 2, thread_name_prefix="directions")
_mapo_ring = json.loads(BOUNDARY_PATH.read_text(encoding="utf-8"))["geometry"]["coordinates"][0]


@dataclass(frozen=True)
class Travel:
    minutes: float  # 채점용 (반올림 전)
    display_minutes: int
    distance_m: int
    source: str  # directions · estimate
    fetched_at: str | None = None  # Directions를 부른 시각 - AI가 경로 나이(30분 미만)를 봄


@dataclass(frozen=True)
class Picked:
    station: Station
    travel: Travel
    basis: str  # forecast · recent_observation
    congestion: str | None
    wait_p50: int | None
    wait_p90: int | None


def in_mapo(lat: float, lng: float) -> bool:
    """마포구 다각형 안인지 - 프론트 isPointInRing과 같은 방식 (고리 좌표는 [경도, 위도])"""
    inside = False
    j = len(_mapo_ring) - 1
    for i, (lng_a, lat_a) in enumerate(_mapo_ring):
        lng_b, lat_b = _mapo_ring[j]
        if (lat_a > lat) != (lat_b > lat) and lng < (lng_b - lng_a) * (lat - lat_a) / (
            lat_b - lat_a
        ) + lng_a:
            inside = not inside
        j = i
    return inside


def distance_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """두 좌표(위도, 경도)의 직선거리 - 하버사인"""
    lat1, lng1, lat2, lng2 = map(math.radians, (*a, *b))
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    )
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def estimate_minutes(km: float) -> float:
    """AI 추천 모듈의 직선거리 추정 - 2분 + 시속 24km (경로가 없으면 AI가 같은 식으로 계산)"""
    return 2 + 60 * km / 24


def scope_ids(station_id: str, states: list[ChargerState], members: dict) -> tuple[str, ...]:
    """AI 채점 범위 충전기 - 모델 범위(compat_chargers)가 있으면 그것, 없으면 버스 제외 충전기 전부"""
    return tuple(members.get(station_id) or sorted(c.charger_id for c in states))


def meets_charger_filters(
    scope: tuple[str, ...], states: list[ChargerState], filters: RecommendationFilters
) -> bool:
    """AI 규칙과 같게 - 범위 충전기가 모두 커넥터 · 용량 조건을 만족해야 함 (Q3: 같은 충전기 · 모델 범위 일치)"""
    by_id = {c.charger_id: c for c in states}
    for cid in scope:
        c = by_id.get(cid)
        if c is None:
            return False
        if filters.connector_types and not set(c.connector_types) & set(filters.connector_types):
            return False
        if filters.min_capacity_kw is not None and c.capacity_kw < filters.min_capacity_kw:
            return False
    return True


def nearest_candidates(stations, states, origin, filters, members) -> list[tuple[Station, float]]:
    """운영 불가 · 충전기 조건 불일치를 빼고 반경 15km 안에서 가까운 20곳 (Q3: 필터 먼저)

    AI가 다시 걸러 내는 조건이라도 여기서 먼저 빼서 Directions 호출을 아낌
    """
    found = []
    for s in stations:
        if s.congestion == "unavailable":
            continue
        if not meets_charger_filters(
            scope_ids(s.station_id, states[s.station_id], members), states[s.station_id], filters
        ):
            continue
        if filters.status_filter == "available_only" and s.available_chargers == 0:
            continue
        km = distance_km(origin, (s.lat, s.lng))
        if km <= RADIUS_KM:
            found.append((s, km))
    found.sort(key=lambda x: (x[1], x[0].station_id))
    return found[:CANDIDATE_LIMIT]


def _remaining(deadline: float) -> float:
    return max(0.0, deadline - time.monotonic())


def _multi_stage(origin, candidates, deadline) -> dict[str, Travel]:
    """1단계 - 다중 목적지 1회. 10km 밖 후보는 보내지 않음 (그곳은 추정)

    오늘 카카오가 한도 초과로 답했거나 예산 · 한도를 넘으면 DirectionsQuotaExceeded → 2단계로
    """
    # 카카오가 오늘 이미 한도 초과로 답함 - 자정까지 다중 목적지를 건너뜀
    if directions.multi_exhausted_today():
        raise DirectionsQuotaExceeded()
    near = {
        s.station_id: (s.lat, s.lng)
        for s, km in candidates
        if km * 1000 <= directions.KAKAO_MULTI_RADIUS_M
    }
    # 보낼 곳이 없으면 부르지 않음 - 모두 추정
    if not near:
        return {}
    future = _executor.submit(directions.get_travel_times, origin, near)
    summaries = future.result(timeout=_remaining(deadline))
    fetched_at = datetime.now(UTC).isoformat()
    result = {}
    for sid, summary in summaries.items():
        # 그곳만 경로를 못 찾음 - 추정으로 둠
        if summary is None:
            continue
        minutes = summary.duration_sec / 60
        # 0분은 이미 충전소에 있을 때만 - 길찾기와 같은 규칙
        display = 0 if summary.duration_sec == 0 else max(1, round(minutes))
        result[sid] = Travel(minutes, display, summary.distance_m, "directions", fetched_at)
    return result


def _car_stage(origin, candidates, deadline) -> dict[str, Travel]:
    """2단계 - 자동차 길찾기를 후보마다. 이어 쓰기 예산에서 후보 수만큼 먼저 잡아 둔 뒤 동시에 부름"""
    # 키가 없으면 예산을 잡지 않고 모두 추정
    if not directions.has_key():
        return {}
    # 다중 목적지가 늦게 답해 시간이 거의 없으면 부르지 않음 - 결과를 못 기다리고 버리게 됨
    if _remaining(deadline) < CAR_STAGE_MIN_SEC:
        logger.info("남은 시간이 %d초 미만 - 자동차 길찾기 없이 직선거리 추정", CAR_STAGE_MIN_SEC)
        return {}
    try:
        directions.reserve(directions.REC_CAR, len(candidates))
    except DirectionsQuotaExceeded:
        return {}  # 3단계 - 모두 직선거리 추정
    futures = {
        _executor.submit(directions.get_route, origin, (s.lat, s.lng), None): s
        for s, _ in candidates
    }
    done, _ = wait(futures, timeout=_remaining(deadline))
    result = {}
    for future, s in futures.items():
        # 시간 안에 못 받은 곳은 추정
        if future not in done:
            continue
        try:
            route = future.result()
        except ApiError:
            continue  # 키 없음 · 한도 초과 · 경로 없음 · 제공자 오류 - 로그는 directions에서 남김
        except Exception:
            logger.exception("추천 이동시간 조회 오류 - 직선거리 추정으로 대체")
            continue
        minutes = route.duration_sec / 60
        # 0분은 이미 충전소에 있을 때만 - 길찾기와 같은 규칙
        display = 0 if route.duration_sec == 0 else max(1, round(minutes))
        result[s.station_id] = Travel(
            minutes, display, route.distance_m, "directions", route.fetched_at
        )
    return result


def travel_times(origin, candidates) -> dict[str, Travel]:
    """후보 이동시간 - 다중 목적지 1회 → (예산 · 한도 초과면) 자동차 길찾기 → 직선거리 추정. 전체 3초"""
    deadline = time.monotonic() + DIRECTIONS_WAIT_SEC
    fetched: dict[str, Travel] = {}
    use_car = not directions.multi_supported()
    # 네이버 제공자 · 카카오 키 없음 - 다중 목적지 없이 자동차 길찾기 (키가 없으면 그 안에서 추정)
    if use_car:
        logger.info("다중 목적지를 쓸 수 없는 설정 - 자동차 길찾기로 부름")
    else:
        try:
            fetched = _multi_stage(origin, candidates, deadline)
        except DirectionsQuotaExceeded:
            logger.info("다중 목적지 예산 · 한도 초과 - 자동차 길찾기로 이어 씀")
            use_car = True
        except TimeoutError:
            logger.warning("다중 목적지 %d초 안에 응답 없음 - 직선거리 추정", DIRECTIONS_WAIT_SEC)
        except ApiError:
            pass  # 제공자 오류 - 이어 쓰기로 넘기지 않고 추정. 로그는 directions에서 남김
        except Exception:
            logger.exception("추천 이동시간 조회 오류 - 직선거리 추정으로 대체")
    # 다중 목적지를 못 쓰거나 예산 · 한도를 넘었을 때만 자동차 길찾기
    if use_car:
        fetched = _car_stage(origin, candidates, deadline)
    result = {}
    for s, km in candidates:
        # 받은 곳은 그대로, 못 받은 곳은 직선거리 추정
        if s.station_id in fetched:
            result[s.station_id] = fetched[s.station_id]
            continue
        minutes = estimate_minutes(km)
        result[s.station_id] = Travel(minutes, max(1, round(minutes)), round(km * 1000), "estimate")
    estimated = len(candidates) - len(fetched)
    if estimated:
        logger.info("추천 이동시간 %d/%d곳 직선거리 추정", estimated, len(candidates))
    return result


def failed_after(db: Session, target: str, started_at: datetime) -> bool:
    """마지막 성공 회차 뒤에 실패한 회차가 있는지 - AI는 관측 뒤 실패가 있으면 그 관측을 근거로 안 씀"""
    return bool(
        db.scalar(
            select(
                exists().where(
                    CollectionRun.target == target,
                    CollectionRun.status == "FAILED",
                    CollectionRun.started_at > started_at,
                )
            )
        )
    )


def candidate_input(
    request_id: str,
    now: datetime,
    station: Station,
    km: float,
    travel: Travel,
    filters: RecommendationFilters,
    states: list[ChargerState],
    members: dict,
    boundary: bool,
) -> dict:
    """AI 후보 입력 (HandoffCandidateInput.from_mapping 형식)"""
    sid = station.station_id
    scope = scope_ids(sid, states, members)
    by_id = {c.charger_id: c for c in states}
    route = None
    if travel.source == "directions" and travel.fetched_at:
        route = {
            "travel_minutes": travel.minutes,
            "requested_at": travel.fetched_at,
            "source": "directions",
            "distance_km": travel.distance_m / 1000,
        }
    observations = []
    for cid in scope:
        c = by_id.get(cid)
        observations.append(
            {
                "charger_id": cid,
                "observed_at": c.observed_at.isoformat() if c and c.observed_at else None,
                "stat": c.stat if c else None,
                "known": bool(c and c.stat is not None),
                # 현재 기록은 원본(복원값은 2026-10-03 이전에만 있음)
                "genuine": True,
                "boundary_after_observation": boundary,
            }
        )
    return {
        "request_id": request_id,
        "candidate_id": f"{request_id}:{sid}",
        "station_id": sid,
        "request_at": now.isoformat(),
        "requested_charger_ids": list(scope),
        "chargers": [
            {
                "station_id": sid,
                "charger_id": cid,
                "connectors": list(by_id[cid].connector_types),
                "output_kw": float(by_id[cid].capacity_kw),
                # 이용 제한(limitYn=Y) 충전기는 수집 단계에서 이미 뺌
                "accessible": True,
            }
            for cid in scope
            if cid in by_id
        ],
        "requirements": {
            "connectors": list(filters.connector_types),
            "min_output_kw": filters.min_capacity_kw,
            "require_accessible": True,
            "available_now_only": filters.status_filter == "available_only",
            "exclude_current_congested": False,
        },
        "station_accessible": True,
        "distance_km": km,
        "route": route,
        "current_evidence": {
            "station_id": sid,
            "charger_ids": list(scope),
            "member_observations": observations,
        },
    }


def forecast_levels(prediction: dict) -> dict[tuple[str, int], str]:
    """(충전소, 시점) → 예측 혼잡도. AI가 고른 예측과 같은 회차 원본에서 읽음"""
    levels = {}
    for row in prediction.get("predictions", []):
        congestion = row["components"]["congestion"]
        label = CONGESTIONS.get(congestion.get("congestion_level"))
        if congestion.get("status") == "ok" and label:
            levels[(row["station_id"], row["horizon_minutes"])] = label
    return levels


def pick(evaluation, stations, travel, levels, filters) -> list[Picked]:
    """AI 결과에서 sort_key 순으로, 충전소 중복 없이 Top 3 (AI 예제 examples/score_cached.tab_list와 같음)"""
    eligible = [
        row for row in (evaluation or {}).get("candidate_evaluations", []) if row["eligible"]
    ]
    picked, seen = [], set()
    for row in sorted(eligible, key=lambda r: r["sort_key"]):
        sid = row["station_id"]
        if sid in seen:
            continue
        station = stations[sid]
        if row["recommendation_source"] in FORECAST_SOURCES:
            basis = "forecast"
            congestion = levels.get((sid, row["selected_horizon_minutes"]))
            show = settings.show_wait_prediction
            p50, p90 = row.get("p50_minutes"), row.get("p90_minutes")
            wait_p50 = round_wait(p50) if show and p50 is not None else None
            wait_p90 = round_wait(p90) if show and p90 is not None else None
        else:
            basis = "recent_observation"
            congestion = station.congestion if station.congestion in CONGESTION_ORDER else None
            wait_p50 = wait_p90 = None
        # 혼잡 제외는 우리 규칙 - 그 탭 혼잡도가 높음이면 빼고 다음 후보로 채움 (2026-11-22 사용자 결정)
        if filters.status_filter == "exclude_high" and congestion == "high":
            continue
        seen.add(sid)
        picked.append(Picked(station, travel[sid], basis, congestion, wait_p50, wait_p90))
        if len(picked) == TOP_N:
            break
    return picked


def reason(item: Picked, nearest: Picked) -> str:
    """가장 가까운 후보와 비교한 문구 (REC-003) - 대기를 숨기는 동안은 혼잡도로 비교"""
    if item.station.station_id == nearest.station.station_id:
        return "가장 가까운 충전소"
    extra = item.travel.display_minutes - nearest.travel.display_minutes
    move = f"가장 가까운 곳보다 {extra}분 더 이동" if extra > 0 else "이동 시간은 비슷함"
    if (
        item.congestion in CONGESTION_ORDER
        and nearest.congestion in CONGESTION_ORDER
        and CONGESTION_ORDER[item.congestion] < CONGESTION_ORDER[nearest.congestion]
    ):
        before, after = CONGESTION_LABEL[nearest.congestion], CONGESTION_LABEL[item.congestion]
        return f"{move}, {before} → {after}"
    return move


def to_recommendations(picked: list[Picked]) -> list[Recommendation]:
    if not picked:
        return []
    nearest = min(picked, key=lambda x: (x.travel.minutes, x.station.station_id))
    return [
        Recommendation(
            rank=i + 1,
            station=RecommendedStation(
                station_id=x.station.station_id,
                name=x.station.name,
                lat=x.station.lat,
                lng=x.station.lng,
                total_chargers=x.station.total_chargers,
                available_chargers=x.station.available_chargers,
            ),
            basis=x.basis,
            congestion=x.congestion,
            wait_time_p50_minutes=x.wait_p50,
            wait_time_p90_minutes=x.wait_p90,
            source="model" if x.basis == "forecast" else None,
            travel_time_minutes=x.travel.display_minutes,
            distance_meters=x.travel.distance_m,
            travel_time_source=x.travel.source,
            reason=reason(x, nearest),
        )
        for i, x in enumerate(picked)
    ]


def log_empty_tabs(tabs: dict[str, dict]) -> None:
    """후보는 있는데 AI가 모두 뺀 탭 - 제외 사유를 WARNING으로 남김 (api는 INFO 로그가 안 찍힘)"""
    for name, evaluation in tabs.items():
        rows = (evaluation or {}).get("candidate_evaluations", [])
        if not rows or any(row["eligible"] for row in rows):
            continue
        reasons = sorted(
            (evaluation.get("exclusion_reasons") or {}).items(), key=lambda kv: (-kv[1], kv[0])
        )
        logger.warning(
            "추천 %s 탭 후보 %d곳 모두 제외 - %s",
            name,
            len(rows),
            ", ".join(f"{reason} {count}" for reason, count in reasons[:5]),
        )


def get_recommendations(db: Session, body: RecommendationRequest) -> RecommendationsResponse:
    if not in_mapo(body.lat, body.lng):
        raise ApiError(422, "OUT_OF_SERVICE_AREA", "현재 충전소 추천 기능은 마포구만 지원해요")
    now = datetime.now(UTC)
    run = latest_success_run(db, MAPO.target)
    states = load_charger_states(db, MAPO.charger_model, MAPO.log_model, run, now)
    stations = area_stations(db, MAPO, run, now, None, None, states)
    boundary = failed_after(db, MAPO.target, run.started_at)
    # Directions를 기다리는 동안 DB 연결을 붙잡지 않게 먼저 풀에 돌려줌 (길찾기와 같음)
    db.close()

    tabs: dict[str, dict] = {}
    by_id: dict[str, Station] = {}
    travel: dict[str, Travel] = {}
    levels: dict[tuple[str, int], str] = {}
    try:
        scorer = get_scorer()
    except AiPackageUnavailable:
        logger.exception("AI 추천 채점을 불러오지 못함 - 추천 목록을 비움")
    else:
        members = scorer.station_members()
        origin = (body.lat, body.lng)
        candidates = nearest_candidates(stations, states, origin, body.filters, members)
        travel = travel_times(origin, candidates)
        # 예측 원본이 없으면(ml 장애 · 만료) 예측 없이 채점 - AI가 최근 관측 근거만 남김
        prediction = load_raw_predictions() or {"run_id": None, "predictions": []}
        levels = forecast_levels(prediction)
        # AI 요청 시각은 길찾기 · 예측을 다 받은 뒤 - 경로 조회 시각이나 예측 생성 시각이 요청보다 늦으면
        # AI가 미래 근거(route_from_future 등)로 보고 후보를 뺌. now는 길찾기 전에 잡아 늘 더 이름
        scored_at = datetime.now(UTC)
        request_id = uuid.uuid4().hex
        inputs = [
            candidate_input(
                request_id,
                scored_at,
                s,
                km,
                travel[s.station_id],
                body.filters,
                states[s.station_id],
                members,
                boundary,
            )
            for s, km in candidates
        ]
        by_id = {s.station_id: s for s, _ in candidates}
        try:
            tabs = scorer.score(prediction, inputs)
        except Exception:
            logger.exception("AI 추천 채점 실패 - 추천 목록을 비움")
            tabs = {}
        log_empty_tabs(tabs)

    return RecommendationsResponse(
        updated_at=run.started_at,
        data_quality=elapsed_quality(run.started_at, now),
        results=[
            HorizonRecommendations(
                horizon_minutes=h,
                recommendations=to_recommendations(
                    pick(tabs.get(name), by_id, travel, levels, body.filters)
                ),
            )
            for h, name in TABS.items()
        ],
    )
