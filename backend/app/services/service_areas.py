from collections import Counter
from dataclasses import asdict
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.db.models import ServiceAreaCharger, ServiceAreaStation, ServiceAreaStatusLog
from app.schemas.service_area import (
    ServiceArea,
    ServiceAreaChargerDetail,
    ServiceAreaChargersResponse,
    ServiceAreasResponse,
    ServiceAreaSummary,
    StatusCounts,
)
from app.services.snapshot import ChargerState, latest_success_run, load_charger_states
from app.services.status import elapsed_quality, station_quality

# DB 방향(service_area_stations.direction)은 한글 - 응답 · 요청은 up · down
DIRECTIONS = {"상행": "up", "하행": "down"}
DB_DIRECTIONS = {v: k for k, v in DIRECTIONS.items()}


def representative(stations: list[ServiceAreaStation], states: dict[str, list[ChargerState]]) -> ServiceAreaStation:
    """길안내 목적지로 쓸 statId - 급속 충전기가 가장 많은 곳, 같으면 station_id 순"""
    # 좌표 평균은 statId가 떨어져 있으면(최대 약 380m) 충전기가 없는 차로 등을 가리킬 수 있어 실제 지점을 고름
    return min(stations, key=lambda s: (-len(states.get(s.station_id, [])), s.station_id))


def get_service_areas(db: Session) -> ServiceAreasResponse:
    run = latest_success_run(db, "service_area")
    updated_at = run.started_at
    now = datetime.now(timezone.utc)
    states = load_charger_states(db, ServiceAreaCharger, ServiceAreaStatusLog, run, now)
    stations = db.scalars(select(ServiceAreaStation).where(ServiceAreaStation.station_id.in_(list(states))))

    # 사업자마다 statId가 달라 휴게소 · 방향 단위로 묶음
    groups: dict[tuple[str, str], list[ServiceAreaStation]] = {}
    for s in stations:
        groups.setdefault((s.service_area_name, s.direction), []).append(s)

    areas = []
    for (name, direction), group in sorted(groups.items()):
        chargers = [c for s in group for c in states[s.station_id]]
        rep = representative(group, states)
        statuses = [c.status for c in chargers]
        counts = Counter(statuses)
        areas.append(ServiceArea(
            name=name,
            route=rep.route,
            direction=DIRECTIONS[direction],
            address=rep.addr,
            lat=rep.lat,
            lng=rep.lng,
            total_chargers=len(chargers),
            available_chargers=counts["available"],
            status_counts=StatusCounts(**{status: counts[status] for status in StatusCounts.model_fields}),
            data_quality=station_quality(statuses, updated_at, now),
        ))
    return ServiceAreasResponse(
        updated_at=updated_at,
        data_quality=elapsed_quality(updated_at, now),
        service_areas=areas,
    )


def get_service_area_chargers(db: Session, name: str, direction: str) -> ServiceAreaChargersResponse:
    stations = db.scalars(
        select(ServiceAreaStation)
        .where(ServiceAreaStation.service_area_name == name,
               ServiceAreaStation.direction == DB_DIRECTIONS[direction])
        .order_by(ServiceAreaStation.station_id)
    ).all()
    run = latest_success_run(db, "service_area")
    updated_at = run.started_at
    now = datetime.now(timezone.utc)
    # 휴게소 전체가 27기라 지역 전체를 읽고 해당 statId만 고름
    states = load_charger_states(db, ServiceAreaCharger, ServiceAreaStatusLog, run, now)
    chargers = [
        ServiceAreaChargerDetail(**asdict(c), operator=s.operator)
        for s in stations
        for c in states.get(s.station_id, [])
    ]
    if not chargers:
        raise ApiError(404, "SERVICE_AREA_NOT_FOUND", "휴게소를 찾을 수 없습니다.")
    rep = representative(stations, states)
    return ServiceAreaChargersResponse(
        updated_at=updated_at,
        data_quality=elapsed_quality(updated_at, now),
        service_area=ServiceAreaSummary(
            name=name,
            route=rep.route,
            direction=direction,
            address=rep.addr,
            lat=rep.lat,
            lng=rep.lng,
            total_chargers=len(chargers),
            available_chargers=sum(c.status == "available" for c in chargers),
        ),
        chargers=chargers,
    )
