import gzip
import threading
import time
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.db.models import (
    CityCharger,
    CityStation,
    CityStatusLog,
    CollectionRun,
    LiveCharger,
    LiveStation,
    LiveStatusLog,
)
from app.schemas.common import Charger, ChargerDetail
from app.schemas.station import Station, StationDetail, StationDetailResponse, StationsResponse
from app.services.predictions import build_predictions, load_baseline, load_model_predictions
from app.services.snapshot import (
    ChargerState,
    find_latest_success_run,
    latest_success_run,
    load_charger_states,
)
from app.services.status import current_congestion, elapsed_quality, station_quality


@dataclass(frozen=True)
class Area:
    """충전소 출처 - 마포(예측 · 추천 대상)와 서울(마포 제외, 실시간 표시만)은 테이블 · 회차가 따로임"""

    target: str  # collection_runs.target
    station_model: type
    charger_model: type
    log_model: type
    prediction_available: bool


MAPO = Area("city", CityStation, CityCharger, CityStatusLog, True)
# 서울은 예측 · 기준선이 없음 - predictions는 형식만 유지하고 값은 전부 null (build_predictions에 둘 다 None)
SEOUL = Area("live", LiveStation, LiveCharger, LiveStatusLog, False)

STATIONS_CACHE_SEC = 30  # 목록 응답 캐시 유효 시간 (get_stations_payload)
GZIP_LEVEL = 6  # 목록 압축본 - nginx 기본(1)보다 높게. 캐시를 만들 때 한 번만 압축함
# (회차 키, 만든 시각 monotonic, 응답)
_stations_cache: tuple[tuple, float, "StationsPayload"] | None = None
_stations_lock = threading.Lock()


def build_station(
    schema,
    charger_schema,
    station,
    chargers: list[ChargerState],
    updated_at: datetime,
    now: datetime,
    model: dict | None,
    baseline: dict | None,
    prediction_available: bool,
):
    """목록(Station · Charger)과 상세(StationDetail · ChargerDetail)가 충전기 필드만 달라 스키마를 받음"""
    statuses = [c.status for c in chargers]
    quality = station_quality(statuses, updated_at, now)
    return schema(
        station_id=station.station_id,
        name=station.name,
        address=station.addr,
        lat=station.lat,
        lng=station.lng,
        operator=station.operator,
        total_chargers=len(chargers),
        available_chargers=statuses.count("available"),
        slow_charger_count=station.slow_charger_count,
        mid_charger_count=station.mid_charger_count,
        congestion=current_congestion(statuses),
        data_quality=quality,
        prediction_available=prediction_available,
        chargers=[charger_schema.model_validate(c, from_attributes=True) for c in chargers],
        predictions=build_predictions(station.station_id, quality, model, baseline, now),
    )


def area_stations(
    db: Session,
    area: Area,
    run: CollectionRun,
    now: datetime,
    model: dict | None,
    baseline: dict | None,
    states: dict[str, list[ChargerState]] | None = None,
) -> list[Station]:
    """한 출처의 충전소 목록 - 충전소별 dataQuality는 그 출처의 회차 기준

    states: 이미 읽은 충전기 상태가 있으면 다시 조회하지 않음 (추천이 AI 채점용 관측 시각과 같이 씀)
    """
    if states is None:
        states = load_charger_states(db, area.charger_model, area.log_model, run, now)
    stations = db.scalars(
        select(area.station_model)
        .where(area.station_model.station_id.in_(list(states)))
        .order_by(area.station_model.station_id)
    )
    if not area.prediction_available:
        model = baseline = None
    return [
        build_station(
            Station,
            Charger,
            s,
            states[s.station_id],
            run.started_at,
            now,
            model,
            baseline,
            area.prediction_available,
        )
        for s in stations
    ]


def get_stations(db: Session) -> StationsResponse:
    city_run = latest_success_run(db, MAPO.target)
    # 서울 회차가 없으면(수집 전 · 장애) 마포만 줌 - 서울 수집 문제가 마포 화면까지 막지 않게 함
    live_run = find_latest_success_run(db, SEOUL.target)
    return build_stations_response(db, city_run, live_run)


@dataclass(frozen=True)
class StationsPayload:
    """목록 응답 JSON과 그 gzip 압축본 - 클라이언트가 gzip을 받으면 압축본을 그대로 보냄"""

    body: bytes
    gzip_body: bytes


def get_stations_payload(db: Session) -> StationsPayload:
    """GET /stations 응답 - 같은 회차면 STATIONS_CACHE_SEC 동안 만든 결과를 그대로 줌

    목록은 요청마다 1,600여 곳을 DB에서 읽고 조립해 무거움(실서버 약 0.25초). 데이터는 수집 회차(5분)마다만 바뀜
    - 키를 회차 id로 잡아 새 회차가 들어오면 바로 다시 만듦
    - 시간에 따라 바뀌는 값(dataQuality · 20분 지난 상태의 unknown · 기준선 시간대)과 회차보다 늦게 들어오는
      예측(pred:v2)은 유효 시간만큼 늦게 반영됨 - 화면은 1분마다 다시 부르고 경계는 10 · 20분 단위라 30초면 충분
    - 워커마다 따로 둠. 만들 때는 잠금으로 한 요청만 계산하고 나머지는 기다렸다가 결과를 같이 씀
    - gzip 압축본도 만들 때 한 번만 만듦 - 원본이 약 1.4MB라 nginx가 요청마다 압축하면 서버 실측 12.6ms(level 1)로
      캐시를 꺼내는 시간(약 7ms)보다 큼. level 6은 20.8ms지만 30초에 한 번이고 크기도 level 1 압축본 124KB → 90KB로 줄어듦
    """
    global _stations_cache
    city_run = latest_success_run(db, MAPO.target)
    live_run = find_latest_success_run(db, SEOUL.target)
    key = (city_run.id, live_run.id if live_run else None)
    payload = _cached_stations(key)
    if payload is not None:
        return payload
    with _stations_lock:
        # 잠금을 기다리는 동안 다른 요청이 만들었으면 그대로 씀
        payload = _cached_stations(key)
        if payload is None:
            response = build_stations_response(db, city_run, live_run)
            body = response.model_dump_json(by_alias=True).encode()
            # mtime=0 - 같은 내용이면 압축본도 같은 바이트가 되게 함
            payload = StationsPayload(body, gzip.compress(body, GZIP_LEVEL, mtime=0))
            _stations_cache = (key, time.monotonic(), payload)
    return payload


def accepts_gzip(accept_encoding: str) -> bool:
    """Accept-Encoding이 gzip을 받는지 - gzip을 직접 적은 값이 *보다 우선, q=0은 거부"""
    q_by_name = {}
    for item in accept_encoding.split(","):
        name, *params = (part.strip() for part in item.split(";"))
        q = 1.0
        for param in params:
            key, _, value = param.partition("=")
            if key.strip().lower() == "q":
                try:
                    q = float(value)
                except ValueError:
                    q = 0.0
        q_by_name[name.lower()] = q
    q = q_by_name.get("gzip", q_by_name.get("*", 0.0))
    return q > 0


def _cached_stations(key: tuple) -> StationsPayload | None:
    cache = _stations_cache
    if cache and cache[0] == key and time.monotonic() - cache[1] < STATIONS_CACHE_SEC:
        return cache[2]
    return None


def build_stations_response(
    db: Session, city_run: CollectionRun, live_run: CollectionRun | None
) -> StationsResponse:
    now = datetime.now(UTC)
    model, baseline = load_model_predictions(), load_baseline()
    stations = area_stations(db, MAPO, city_run, now, model, baseline)
    updated_at = city_run.started_at
    if live_run is not None:
        stations += area_stations(db, SEOUL, live_run, now, None, None)
        # 최상위 기준 시각은 응답에 든 두 출처 중 오래된 쪽 (서울 확대 설계 C안)
        updated_at = min(updated_at, live_run.started_at)
    return StationsResponse(
        updated_at=updated_at,
        data_quality=elapsed_quality(updated_at, now),
        stations=stations,
    )


def get_station(db: Session, station_id: str) -> StationDetailResponse:
    # 마포 → 서울 순으로 찾음 (마포를 빼고 서울을 수집하므로 ID가 겹치지 않음)
    for area in (MAPO, SEOUL):
        station = db.get(area.station_model, station_id)
        if station is not None:
            break
    else:
        raise ApiError(404, "STATION_NOT_FOUND", "충전소를 찾을 수 없습니다.")
    run = latest_success_run(db, area.target)
    now = datetime.now(UTC)
    states = load_charger_states(
        db, area.charger_model, area.log_model, run, now, station_id=station_id
    )
    # 버스전용만 있는 충전소 - 목록에서 빠지므로 상세도 없는 충전소로 처리
    if station_id not in states:
        raise ApiError(404, "STATION_NOT_FOUND", "충전소를 찾을 수 없습니다.")
    if area.prediction_available:
        model, baseline = load_model_predictions(), load_baseline()
    else:
        model = baseline = None
    return StationDetailResponse(
        updated_at=run.started_at,
        data_quality=elapsed_quality(run.started_at, now),
        station=build_station(
            StationDetail,
            ChargerDetail,
            station,
            states[station_id],
            run.started_at,
            now,
            model,
            baseline,
            area.prediction_available,
        ),
    )
