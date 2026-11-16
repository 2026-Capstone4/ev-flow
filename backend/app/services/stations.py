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
) -> list[Station]:
    """한 출처의 충전소 목록 - 충전소별 dataQuality는 그 출처의 회차 기준"""
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
    now = datetime.now(UTC)
    city_run = latest_success_run(db, MAPO.target)
    model, baseline = load_model_predictions(), load_baseline()
    stations = area_stations(db, MAPO, city_run, now, model, baseline)
    updated_at = city_run.started_at
    # 서울 회차가 없으면(수집 전 · 장애) 마포만 줌 - 서울 수집 문제가 마포 화면까지 막지 않게 함
    live_run = find_latest_success_run(db, SEOUL.target)
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
