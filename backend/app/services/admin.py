"""운영자 대시보드 집계 - docs/api/admin.md 10~13번 (ADM-001 ~ 004)

관측 = 수집 성공 회차(SUCCESS · PARTIAL)에 저장된 상태 로그 1행. FAILED 소급 회차의 로그는
직전 상태를 복사한 것이라 뺌. 버스전용은 모든 집계에서 뺌 - 결측은 collection_runs의
서비스 대상 기준 수(eligible_*)를 씀. 시간 구간은 모두 회차 시작 시각(started_at) 기준.
"""

import logging
from collections import defaultdict
from datetime import UTC, date, datetime, time, timedelta

import redis
from sqlalchemy import Integer, cast, extract, func, literal_column, select, tuple_
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import (
    CityCharger,
    CityStation,
    CityStatusLog,
    CollectionRun,
    ServiceAreaCharger,
    ServiceAreaStation,
    ServiceAreaStatusLog,
)
from app.schemas.admin import (
    AdminCharger,
    AdminChargersResponse,
    CollectionStatusResponse,
    CollectionTarget,
    MissingBucket,
    MissingStatsResponse,
    UtilizationBucket,
    UtilizationResponse,
)
from app.schemas.base import KST
from app.services.snapshot import latest_success_run, load_charger_states
from app.services.status import BUS_CHARGER_TYPE, STAT_TO_STATUS

logger = logging.getLogger(__name__)

# collection_runs.target → (충전소, 충전기, 상태 로그) 모델
TARGETS = {
    "city": (CityStation, CityCharger, CityStatusLog),
    "service_area": (ServiceAreaStation, ServiceAreaCharger, ServiceAreaStatusLog),
}
# 수집 기록이 하나도 없을 때만 씀 - collector JOBS와 같음
DEFAULT_ZSCODES = {"city": "11440", "service_area": "C0"}

SAVED_RUN_STATUSES = ("SUCCESS", "PARTIAL")  # 상태 로그를 저장한 회차
CHARGING_STATS = tuple(s for s, v in STAT_TO_STATUS.items() if v == "charging")  # 3 · 6
AVAILABLE_STATS = tuple(s for s, v in STAT_TO_STATUS.items() if v == "available")  # 2

UTILIZATION_DAYS = 28  # week = 오늘 포함 최근 4주
MISSING_DAYS = 7  # week = 오늘 포함 최근 7일
WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"]

# 문자열을 SQL에 그대로 넣음 - 바인드 파라미터면 SELECT와 GROUP BY의 식이 달라져 집계 오류가 남
KST_ZONE = literal_column("'Asia/Seoul'")

# 상태 로그 저장 시각은 회차 시작 뒤 길어야 몇 분 - collected_at 조건으로 인덱스 범위를 좁힐 때 여유
LOG_SAVED_WITHIN = timedelta(minutes=10)

# 끝난 날의 일별 이용률 집계 - 값이 바뀌지 않아 한 번만 계산함 (4주 집계가 상태 로그 전체를 훑지 않게)
DAY_CACHE_KEY = "admin:occ:v1:{target}:{day}"
DAY_CACHE_TTL_SEC = 40 * 24 * 3600
DAY_CLOSED_AFTER = timedelta(minutes=10)  # 자정을 넘겨 커밋되는 회차를 기다린 뒤 저장
_redis = redis.Redis.from_url(settings.redis_url, socket_timeout=1, socket_connect_timeout=1)


def targets_of(region: str) -> list[str]:
    return list(TARGETS) if region == "all" else [region]


def kst_today(now: datetime) -> date:
    return now.astimezone(KST).date()


def day_start(day: date) -> datetime:
    return datetime.combine(day, time(), tzinfo=KST)


def ratio(part: int, whole: int) -> float | None:
    return round(part / whole, 4) if whole else None


def log_counts(db: Session, target: str, start: datetime, end: datetime, group: str) -> dict:
    """[start, end)에 시작한 성공 회차의 상태 로그(버스전용 제외)를 group별로 셈 -
    (충전 중 수, 이용률 분모). group: hour(KST 시 0~23) · date(KST 날짜) · charger"""
    _, charger, log = TARGETS[target]
    kst = func.timezone(KST_ZONE, CollectionRun.started_at)
    keys = {
        "hour": [cast(extract("hour", kst), Integer)],
        "date": [func.date(kst)],
        "charger": [log.station_id, log.charger_id],
    }[group]
    # 버스전용은 충전기 표와 조인하지 않고 NOT IN으로 뺌 - 조인하면 플래너가 충전기마다 lookup 인덱스로
    # 흩어 읽음(서버 2026-11-24 오늘 56.5만 행에 6.8초). 조인이 없어야 collected_at 인덱스로 오늘 구간만 이어 읽음
    bus = select(charger.station_id, charger.charger_id).where(
        charger.charger_type == BUS_CHARGER_TYPE
    )
    query = (
        select(
            *keys,
            func.count().filter(log.stat.in_(CHARGING_STATS)),
            func.count().filter(log.stat.in_(CHARGING_STATS + AVAILABLE_STATS)),
        )
        .select_from(log)
        .join(CollectionRun, CollectionRun.id == log.collection_run_id)
        .where(
            log.collected_at >= start,
            log.collected_at < end + LOG_SAVED_WITHIN,
            CollectionRun.started_at >= start,
            CollectionRun.started_at < end,
            tuple_(log.station_id, log.charger_id).not_in(bus),
            CollectionRun.status.in_(SAVED_RUN_STATUSES),
        )
        .group_by(*keys)
    )
    counts = {}
    for *key, charging, observed in db.execute(query):
        counts[key[0] if len(key) == 1 else tuple(key)] = (charging, observed)
    return counts


def daily_log_counts(db: Session, target: str, days: list[date], now: datetime) -> dict:
    """날짜별 log_counts. days는 오름차순. 끝난 날은 Redis에 저장해 두고 씀 -
    Redis 장애면 DB에서 바로 셈"""
    keys = [DAY_CACHE_KEY.format(target=target, day=d.isoformat()) for d in days]
    counts: dict[date, tuple[int, int]] = {}
    try:
        for day, raw in zip(days, _redis.mget(keys), strict=True):
            if raw is not None:
                counts[day] = tuple(int(v) for v in raw.decode().split(","))
    except redis.RedisError:
        logger.warning("Redis 오류 - 일별 집계를 DB에서 바로 계산", exc_info=True)

    missing = [d for d in days if d not in counts]
    if not missing:
        return counts
    computed = log_counts(
        db, target, day_start(missing[0]), day_start(missing[-1] + timedelta(days=1)), "date"
    )
    for day in missing:
        counts[day] = computed.get(day, (0, 0))
    closed = [d for d in missing if day_start(d + timedelta(days=1)) + DAY_CLOSED_AFTER <= now]
    if closed:
        try:
            pipe = _redis.pipeline()
            for day in closed:
                key = DAY_CACHE_KEY.format(target=target, day=day.isoformat())
                pipe.set(key, ",".join(map(str, counts[day])), ex=DAY_CACHE_TTL_SEC)
            pipe.execute()
        except redis.RedisError:
            logger.warning("Redis 오류 - 일별 집계를 저장하지 못함", exc_info=True)
    return counts


def get_utilization(
    db: Session, region: str, period: str, now: datetime | None = None
) -> UtilizationResponse:
    now = now or datetime.now(UTC)
    today = kst_today(now)
    totals: dict[int, list[int]] = defaultdict(lambda: [0, 0])
    if period == "day":
        start = day_start(today)
        buckets = [(hour, f"{hour}시") for hour in range(24)]
        for target in targets_of(region):
            for hour, (charging, observed) in log_counts(db, target, start, now, "hour").items():
                totals[hour][0] += charging
                totals[hour][1] += observed
    else:
        days = [today - timedelta(days=i) for i in range(UTILIZATION_DAYS - 1, -1, -1)]
        start = day_start(days[0])
        buckets = list(enumerate(WEEKDAY_LABELS))
        for target in targets_of(region):
            for day, (charging, observed) in daily_log_counts(db, target, days, now).items():
                totals[day.weekday()][0] += charging
                totals[day.weekday()][1] += observed

    series = [
        UtilizationBucket(
            bucket=bucket,
            label=label,
            occupancy_rate=ratio(*totals[bucket]),
            observation_count=totals[bucket][1],
        )
        for bucket, label in buckets
    ]
    return UtilizationResponse(
        region=region,
        period=period,
        from_=start,
        to=now,
        average_occupancy_rate=ratio(
            sum(c for c, _ in totals.values()), sum(o for _, o in totals.values())
        ),
        series=series,
    )


def get_chargers(db: Session, region: str, now: datetime | None = None) -> AdminChargersResponse:
    now = now or datetime.now(UTC)
    today_start = day_start(kst_today(now))
    chargers: list[AdminCharger] = []
    updated: list[datetime] = []
    for target in targets_of(region):
        station_model, charger_model, log_model = TARGETS[target]
        run = latest_success_run(db, target)  # 수집 기록이 없으면 503
        updated.append(run.started_at)
        states = load_charger_states(db, charger_model, log_model, run, now)
        stations = db.scalars(
            select(station_model).where(station_model.station_id.in_(list(states)))
        )
        names = {
            s.station_id: (s.name if target == "city" else s.service_area_name or s.name)
            or s.station_id
            for s in stations
        }
        today = log_counts(db, target, today_start, now, "charger")
        for station_id, station_chargers in states.items():
            for c in station_chargers:
                chargers.append(
                    AdminCharger(
                        region=target,
                        station_id=station_id,
                        station_name=names[station_id],
                        charger_id=c.charger_id,
                        status=c.status,
                        stat=c.stat,
                        unstable=c.unstable,
                        today_occupancy_rate=ratio(*today.get((station_id, c.charger_id), (0, 0))),
                        stat_updated_at=c.stat_upd_dt,
                    )
                )
    return AdminChargersResponse(updated_at=min(updated), chargers=chargers)


def get_collection_status(
    db: Session, region: str, now: datetime | None = None
) -> CollectionStatusResponse:
    now = now or datetime.now(UTC)
    today_start = day_start(kst_today(now))
    run = CollectionRun
    targets = []
    for target in targets_of(region):
        last = db.scalar(
            select(run).where(run.target == target).order_by(run.started_at.desc()).limit(1)
        )
        last_success_at = db.scalar(
            select(func.max(run.started_at)).where(run.target == target, run.status == "SUCCESS")
        )
        failed, latency = db.execute(
            select(
                func.count().filter(run.status.in_(("FAILED", "PARTIAL"))),
                func.avg(run.api_latency_ms),
            ).where(run.target == target, run.started_at >= today_start)
        ).one()
        targets.append(
            CollectionTarget(
                target=target,
                zscode=last.zscode if last else DEFAULT_ZSCODES[target],
                last_run_at=last.started_at if last else None,
                last_status=last.status.lower() if last else None,
                last_success_at=last_success_at,
                failed_runs_today=failed,
                last_api_latency_ms=last.api_latency_ms if last else None,
                average_api_latency_ms_today=round(latency) if latency is not None else None,
            )
        )
    return CollectionStatusResponse(targets=targets)


def get_missing_stats(
    db: Session, region: str, period: str, now: datetime | None = None
) -> MissingStatsResponse:
    now = now or datetime.now(UTC)
    today = kst_today(now)
    run = CollectionRun
    kst = func.timezone(KST_ZONE, run.started_at)
    if period == "day":
        start = day_start(today)
        key = cast(extract("hour", kst), Integer)
        buckets = [(hour, hour, f"{hour}시") for hour in range(24)]
    else:
        days = [today - timedelta(days=i) for i in range(MISSING_DAYS - 1, -1, -1)]
        start = day_start(days[0])
        key = func.date(kst)
        buckets = [(d, d.isoformat(), f"{d.month}/{d.day}") for d in days]

    rows = db.execute(
        select(
            key,
            func.sum(run.eligible_expected_count),
            func.sum(run.eligible_matched_count),
            func.count(),
            func.count().filter(run.status == "FAILED"),
        )
        .where(
            run.target.in_(targets_of(region)),
            run.started_at >= start,
            run.status != "RUNNING",  # 진행 중인 회차는 아직 저장 전
            # 소급 스크립트로 채우기 전인 회차는 버스전용을 뺄 수 없어 뺌
            run.eligible_expected_count.is_not(None),
        )
        .group_by(key)
    )
    counts = {k: (expected, matched, runs, failed) for k, expected, matched, runs, failed in rows}

    series = []
    for k, bucket, label in buckets:
        expected, matched, runs, failed = counts.get(k, (0, 0, 0, 0))
        series.append(
            MissingBucket(
                bucket=bucket,
                label=label,
                expected_count=expected,
                matched_count=matched,
                missing_count=expected - matched,
                missing_rate=ratio(expected - matched, expected) if runs else None,
                failed_runs=failed,
            )
        )
    return MissingStatsResponse(region=region, period=period, from_=start, to=now, series=series)
