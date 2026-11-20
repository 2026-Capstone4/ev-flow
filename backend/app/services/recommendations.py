"""충전소 추천 (POST /recommendations, UC-U06) - 마포 충전소 중 탭(0 · 15 · 30분 후 출발)별 Top 3

docs/api/user.md 3번
- 점수 = 이동시간/30 + 점유율 (낮을수록 좋음) - AI 추천 모듈 combined_score와 같은 식 (11/15 합의 Q5)
- 지금 출발은 현재 상태로, 15 · 30분 후 출발은 도착 시각(h + 이동시간)에 가까운 예측 시점의 모델 값으로 계산
- 이동시간은 가까운 20곳만 Directions(길찾기와 같은 캐시 · 하루 예산), 3초 안에 못 받으면 직선거리 추정
"""

import json
import logging
import math
from concurrent.futures import ThreadPoolExecutor, wait
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy.orm import Session

from app.api.errors import ApiError
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
from app.services.predictions import load_model_predictions
from app.services.snapshot import latest_success_run
from app.services.stations import MAPO, area_stations
from app.services.status import elapsed_quality

logger = logging.getLogger(__name__)

HORIZONS = (0, 15, 30)
PREDICTION_HORIZONS = (15, 30)
TOP_N = 3
CANDIDATE_LIMIT = 20  # Directions를 부르는 후보 수 (MAP-02)
RADIUS_KM = 15
DIRECTIONS_WAIT_SEC = 3  # 이 안에 못 받은 후보는 직선거리 추정 - 늦게 온 결과는 경로 캐시에만 남음
TRAVEL_SCALE_MIN = 30.0
CONGESTION_ORDER = {"low": 0, "medium": 1, "high": 2}
CONGESTION_LABEL = {"low": "여유", "medium": "보통", "high": "혼잡"}
BOUNDARY_PATH = Path(__file__).resolve().parents[2] / "data" / "mapo_boundary.json"

# 요청이 여럿 겹쳐도 Directions 동시 호출 수를 묶음
_executor = ThreadPoolExecutor(max_workers=CANDIDATE_LIMIT * 2, thread_name_prefix="directions")
_mapo_ring = json.loads(BOUNDARY_PATH.read_text(encoding="utf-8"))["geometry"]["coordinates"][0]


@dataclass(frozen=True)
class Travel:
    minutes: float  # 점수용 (반올림 전)
    display_minutes: int
    distance_m: int
    source: str  # directions · estimate


@dataclass(frozen=True)
class Scored:
    station: Station
    travel: Travel
    congestion: str
    wait_p50: int | None
    wait_p90: int | None
    source: str | None
    cost: float


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
    """AI 추천 모듈의 직선거리 추정 - 2분 + 시속 24km"""
    return 2 + 60 * km / 24


def matches_chargers(station: Station, filters: RecommendationFilters) -> bool:
    """같은 충전기 하나가 커넥터 · 용량 · (사용 가능만) 조건을 모두 만족하면 남김 (필터 판정 규칙)"""
    return any(
        (not filters.connector_types or set(c.connector_types) & set(filters.connector_types))
        and (filters.min_capacity_kw is None or c.capacity_kw >= filters.min_capacity_kw)
        and (filters.status_filter != "available_only" or c.status == "available")
        for c in station.chargers
    )


def nearest_candidates(stations, origin, filters) -> list[tuple[Station, float]]:
    """운영 불가 · 충전기 조건 불일치를 빼고 반경 15km 안에서 가까운 20곳 (Q3: 필터 먼저)"""
    found = []
    for s in stations:
        if s.congestion == "unavailable" or not matches_chargers(s, filters):
            continue
        km = distance_km(origin, (s.lat, s.lng))
        if km <= RADIUS_KM:
            found.append((s, km))
    found.sort(key=lambda x: (x[1], x[0].station_id))
    return found[:CANDIDATE_LIMIT]


def travel_times(origin, candidates) -> dict[str, Travel]:
    """후보마다 Directions를 동시에 부르고 3초까지만 기다림. 실패 · 시간 초과는 직선거리 추정"""
    futures = {
        _executor.submit(directions.get_route, origin, s.station_id, (s.lat, s.lng)): (s, km)
        for s, km in candidates
    }
    done, _ = wait(futures, timeout=DIRECTIONS_WAIT_SEC)
    result, estimated = {}, 0
    for future, (s, km) in futures.items():
        route = None
        if future in done:
            try:
                route = future.result()
            except ApiError:
                pass  # 키 없음 · 하루 예산 소진 · 경로 없음 · 네이버 오류 - 로그는 directions에서 남김
            except Exception:
                logger.exception("추천 이동시간 조회 오류 - 직선거리 추정으로 대체")
        if route is None:
            estimated += 1
            minutes = estimate_minutes(km)
            result[s.station_id] = Travel(
                minutes, max(1, round(minutes)), round(km * 1000), "estimate"
            )
        else:
            minutes = route.duration_sec / 60
            # 0분은 이미 충전소에 있을 때만 - 길찾기와 같은 규칙
            display = 0 if route.duration_sec == 0 else max(1, round(minutes))
            result[s.station_id] = Travel(minutes, display, route.distance_m, "directions")
    if estimated:
        logger.info("추천 이동시간 %d/%d곳 직선거리 추정", estimated, len(candidates))
    return result


def current_occupancy(station: Station) -> float | None:
    """지금 점유율 = 충전 중 / (사용 가능 + 충전 중). 운영 중인 충전기가 없으면 None"""
    statuses = [c.status for c in station.chargers]
    available, charging = statuses.count("available"), statuses.count("charging")
    return charging / (available + charging) if available + charging else None


def pick_horizon(base_time: datetime, arrival: datetime) -> int:
    """도착 시각에 가장 가까운 예측 시점, 같으면 이른 쪽 - AI 추천 모듈과 같은 규칙"""
    return min(
        PREDICTION_HORIZONS,
        key=lambda h: (abs((base_time + timedelta(minutes=h) - arrival).total_seconds()), h),
    )


def score_tab(h, candidates, travel, filters, model, now) -> list[Scored]:
    scored = []
    base_time = datetime.fromisoformat(model["base_time"]) if model else None
    for s, _km in candidates:
        t = travel[s.station_id]
        if h == 0:
            congestion, occupancy = s.congestion, current_occupancy(s)
            wait_p50 = wait_p90 = source = None
            if congestion not in CONGESTION_ORDER:  # 확인 불가(unknown)는 지금 출발 후보에서 뺌
                continue
        else:
            cells = model["stations"].get(s.station_id) if model else None
            if not cells:
                continue
            horizon = pick_horizon(base_time, now + timedelta(minutes=h + t.minutes))
            cell = next((c for c in cells if c["horizon"] == horizon), None)
            pred = next((p for p in s.predictions if p.horizon_minutes == horizon), None)
            # 충전소 dataQuality가 baseline이면 예측이 기준선으로 바뀜 - 모델 값일 때만 씀
            if cell is None or pred is None or pred.source != "model":
                continue
            congestion, occupancy = pred.congestion, cell.get("occupancy")
            wait_p50, wait_p90 = pred.wait_time_p50_minutes, pred.wait_time_p90_minutes
            source = "model"
        if occupancy is None:
            continue
        if filters.status_filter == "exclude_high" and congestion == "high":
            continue
        cost = t.minutes / TRAVEL_SCALE_MIN + occupancy
        scored.append(Scored(s, t, congestion, wait_p50, wait_p90, source, cost))
    scored.sort(key=lambda x: (x.cost, x.travel.minutes, x.station.station_id))
    return scored


def reason(item: Scored, nearest: Scored) -> str:
    """가장 가까운 후보와 비교한 문구 (REC-003) - 대기를 숨기는 동안은 혼잡도로 비교"""
    if item.station.station_id == nearest.station.station_id:
        return "가장 가까운 충전소"
    extra = item.travel.display_minutes - nearest.travel.display_minutes
    move = f"가장 가까운 곳보다 {extra}분 더 이동" if extra > 0 else "이동 시간은 비슷함"
    if CONGESTION_ORDER[item.congestion] < CONGESTION_ORDER[nearest.congestion]:
        before, after = CONGESTION_LABEL[nearest.congestion], CONGESTION_LABEL[item.congestion]
        return f"{move}, {before} → {after}"
    return move


def to_recommendations(scored: list[Scored]) -> list[Recommendation]:
    if not scored:
        return []
    nearest = min(scored, key=lambda x: (x.travel.minutes, x.station.station_id))
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
            congestion=x.congestion,
            wait_time_p50_minutes=x.wait_p50,
            wait_time_p90_minutes=x.wait_p90,
            source=x.source,
            travel_time_minutes=x.travel.display_minutes,
            distance_meters=x.travel.distance_m,
            travel_time_source=x.travel.source,
            reason=reason(x, nearest),
        )
        for i, x in enumerate(scored[:TOP_N])
    ]


def get_recommendations(db: Session, body: RecommendationRequest) -> RecommendationsResponse:
    if not in_mapo(body.lat, body.lng):
        raise ApiError(422, "OUT_OF_SERVICE_AREA", "현재 충전소 추천 기능은 마포구만 지원해요")
    now = datetime.now(UTC)
    run = latest_success_run(db, MAPO.target)
    model = load_model_predictions()
    stations = area_stations(db, MAPO, run, now, model, None)
    # Directions를 기다리는 동안 DB 연결을 붙잡지 않게 먼저 풀에 돌려줌 (길찾기와 같음)
    db.close()
    origin = (body.lat, body.lng)
    candidates = nearest_candidates(stations, origin, body.filters)
    travel = travel_times(origin, candidates)
    return RecommendationsResponse(
        updated_at=run.started_at,
        data_quality=elapsed_quality(run.started_at, now),
        results=[
            HorizonRecommendations(
                horizon_minutes=h,
                recommendations=to_recommendations(
                    score_tab(h, candidates, travel, body.filters, model, now)
                ),
            )
            for h in HORIZONS
        ],
    )
