from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.db.models import CityCharger, CityStation, CityStatusLog
from app.schemas.common import Charger, ChargerDetail
from app.schemas.station import Station, StationDetail, StationDetailResponse, StationsResponse
from app.services.predictions import build_predictions, load_baseline, load_model_predictions
from app.services.snapshot import ChargerState, latest_success_run, load_charger_states
from app.services.status import current_congestion, elapsed_quality, station_quality


def build_station(schema, charger_schema, station: CityStation, chargers: list[ChargerState],
                  updated_at: datetime, now: datetime, model: dict | None, baseline: dict | None):
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
        chargers=[charger_schema.model_validate(c, from_attributes=True) for c in chargers],
        predictions=build_predictions(station.station_id, quality, model, baseline, now),
    )


def get_stations(db: Session) -> StationsResponse:
    run = latest_success_run(db, "city")
    updated_at = run.started_at
    now = datetime.now(timezone.utc)
    states = load_charger_states(db, CityCharger, CityStatusLog, run, now)
    stations = db.scalars(
        select(CityStation).where(CityStation.station_id.in_(list(states))).order_by(CityStation.station_id)
    )
    model, baseline = load_model_predictions(), load_baseline()
    return StationsResponse(
        updated_at=updated_at,
        data_quality=elapsed_quality(updated_at, now),
        stations=[build_station(Station, Charger, s, states[s.station_id], updated_at, now, model, baseline)
                  for s in stations],
    )


def get_station(db: Session, station_id: str) -> StationDetailResponse:
    station = db.get(CityStation, station_id)
    if station is None:
        raise ApiError(404, "STATION_NOT_FOUND", "충전소를 찾을 수 없습니다.")
    run = latest_success_run(db, "city")
    updated_at = run.started_at
    now = datetime.now(timezone.utc)
    states = load_charger_states(db, CityCharger, CityStatusLog, run, now, station_id=station_id)
    # 버스전용만 있는 충전소 - 목록에서 빠지므로 상세도 없는 충전소로 처리
    if station_id not in states:
        raise ApiError(404, "STATION_NOT_FOUND", "충전소를 찾을 수 없습니다.")
    model, baseline = load_model_predictions(), load_baseline()
    return StationDetailResponse(
        updated_at=updated_at,
        data_quality=elapsed_quality(updated_at, now),
        station=build_station(StationDetail, ChargerDetail, station, states[station_id], updated_at, now,
                              model, baseline),
    )
