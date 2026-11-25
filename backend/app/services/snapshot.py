from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import and_, select, true
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.db.models import CollectionRun
from app.services.status import (
    BUS_CHARGER_TYPE,
    CONNECTOR_TYPES,
    is_stale,
    is_unstable,
    to_capacity_kw,
    to_charger_status,
)


@dataclass
class ChargerState:
    """충전기 한 대의 현재 상태 - 스키마 Charger · ChargerDetail로 바꿔 씀 (from_attributes)"""

    station_id: str
    charger_id: str
    status: str
    connector_types: list[str]
    capacity_kw: int | float
    charging_started_at: datetime | None
    # 운영자 충전기 목록(ADM-002)용 원본 값 - 마지막 성공 회차에 행이 없으면 둘 다 None
    stat: str | None = None
    stat_upd_dt: datetime | None = None
    # 원천 데이터 문제로 상태가 계속 바뀌는 충전기인지 (status.UNSTABLE_CHARGERS) - 화면 표시용
    unstable: bool = False
    # 마지막 성공 회차에서 이 충전기 상태를 받은 시각 - 추천의 AI 채점이 관측 나이(15분 미만)를 봄. 행이 없으면 None
    observed_at: datetime | None = None


def find_latest_success_run(db: Session, target: str) -> CollectionRun | None:
    """상태 로그를 저장한 최근 수집(SUCCESS · PARTIAL) - started_at이 응답 updatedAt"""
    return db.scalar(
        select(CollectionRun)
        .where(CollectionRun.target == target, CollectionRun.status.in_(("SUCCESS", "PARTIAL")))
        .order_by(CollectionRun.started_at.desc())
        .limit(1)
    )


def latest_success_run(db: Session, target: str) -> CollectionRun:
    """find_latest_success_run과 같고, 없으면 503"""
    run = find_latest_success_run(db, target)
    if run is None:
        raise ApiError(503, "DATA_UNAVAILABLE", "충전 상태 데이터를 불러올 수 없습니다.")
    return run


def load_charger_states(
    db: Session,
    charger_model,
    log_model,
    run: CollectionRun,
    now: datetime,
    station_id: str | None = None,
) -> dict[str, list[ChargerState]]:
    """충전소별 충전기 현재 상태. 버스전용은 빼므로 버스전용만 있는 충전소는 결과에 없음"""
    charger, log = charger_model, log_model
    # collection_runs 도입 이전에는 FAILED 회차도 행을 남겼으므로 실행 id로 그 회차 행만 고름.
    # 시각 조건은 인덱스 범위를 좁히는 용도 - 행이 없으면 상태를 모르는 충전기
    if station_id is not None:
        # 충전소 하나 - 충전기마다 마지막 성공 회차의 행 하나만 인덱스(station_id, charger_id, collected_at)로 찾음
        latest = (
            select(log.stat, log.stat_upd_dt, log.current_charge_start_dt, log.collected_at)
            .where(
                log.station_id == charger.station_id,
                log.charger_id == charger.charger_id,
                log.collected_at >= run.started_at,
                log.collection_run_id == run.id,
            )
            .order_by(log.collected_at.desc())
            .limit(1)
            .lateral()
        )
        on = true()
    else:
        # 전체 - 그 회차의 행을 회차 · 수집 시각 인덱스로 한 번에 읽어 충전기 표와 맞춤.
        # 충전기마다 찾으면 서울 · 휴게소 약 6천 기를 흩어 읽어 서버에서 3초 걸림 (2026-11-25)
        latest = (
            select(
                log.station_id,
                log.charger_id,
                log.stat,
                log.stat_upd_dt,
                log.current_charge_start_dt,
                log.collected_at,
            )
            .where(log.collected_at >= run.started_at, log.collection_run_id == run.id)
            .distinct(log.station_id, log.charger_id)
            .order_by(log.station_id, log.charger_id, log.collected_at.desc())
            .subquery()
        )
        on = and_(
            latest.c.station_id == charger.station_id, latest.c.charger_id == charger.charger_id
        )
    query = (
        select(
            charger.station_id,
            charger.charger_id,
            charger.charger_type,
            charger.capacity,
            latest.c.stat,
            latest.c.stat_upd_dt,
            latest.c.current_charge_start_dt,
            latest.c.collected_at,
        )
        .outerjoin(latest, on)
        .where(charger.charger_type != BUS_CHARGER_TYPE)
        .order_by(charger.station_id, charger.charger_id)
    )
    if station_id is not None:
        query = query.where(charger.station_id == station_id)

    stale = is_stale(run.started_at, now)
    states: dict[str, list[ChargerState]] = {}
    for row in db.execute(query):
        status = to_charger_status(row.stat, stale)
        states.setdefault(row.station_id, []).append(
            ChargerState(
                station_id=row.station_id,
                charger_id=row.charger_id,
                status=status,
                connector_types=CONNECTOR_TYPES.get(row.charger_type, []),
                capacity_kw=to_capacity_kw(row.capacity),
                charging_started_at=row.current_charge_start_dt if status == "charging" else None,
                stat=row.stat,
                stat_upd_dt=row.stat_upd_dt,
                unstable=is_unstable(row.station_id, row.charger_id),
                observed_at=row.collected_at,
            )
        )
    return states
