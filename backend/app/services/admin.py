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

from app.api.errors import ApiError
from app.config import settings
from app.db.models import (
    CityCharger,
    CityStation,
    CityStatusLog,
    CollectionRun,
    LiveCharger,
    LiveStation,
    LiveStatusLog,
    ServiceAreaCharger,
    ServiceAreaStation,
    ServiceAreaStatusLog,
)
from app.schemas.admin import (
    SEOUL_DISTRICTS,
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
from app.services.service_areas import without_duplicates
from app.services.snapshot import latest_success_run, load_charger_states
from app.services.status import BUS_CHARGER_TYPE, STAT_TO_STATUS

logger = logging.getLogger(__name__)

# collection_runs.target → (충전소, 충전기, 상태 로그) 모델. live는 마포를 뺀 서울 (2026-11-25 추가)
TARGETS = {
    "city": (CityStation, CityCharger, CityStatusLog),
    "live": (LiveStation, LiveCharger, LiveStatusLog),
    "service_area": (ServiceAreaStation, ServiceAreaCharger, ServiceAreaStatusLog),
}
# 요청 region → 집계 대상. seoul은 마포(city) + 나머지 서울(live) - live가 마포를 빼고 받아 겹치지 않음
REGION_TARGETS = {
    "all": list(TARGETS),
    "seoul": ["city", "live"],
    "city": ["city"],
    "service_area": ["service_area"],
}
# 구를 나눌 수 있는 대상 - 서울 구 코드(SEOUL_DISTRICTS) 중 마포구는 city, 나머지는 live에만 있음
DISTRICT_TARGETS = ("city", "live")
CITY_DISTRICT = "11440"
DISTRICT_CODES = {name: code for code, name in SEOUL_DISTRICTS.items()}
# 수집 기록이 하나도 없을 때만 씀 - collector JOBS와 같음
DEFAULT_ZSCODES = {"city": "11440", "live": "11", "service_area": "C0"}

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

# 끝난 날의 구별 이용률 집계 - 해시 필드는 구 코드 + 합계 HOUR_TOTAL_FIELD(저장 표시), 값은 "충전 중,분모"
DISTRICT_DAY_CACHE_KEY = "admin:occ-district:v1:{target}:{day}"

# 오늘(안 끝난 날)은 시간대 단위로 저장 - 끝난 시간대는 한 번만 계산하고 DB에서는 진행 중인 시간대만 읽음.
# 요청마다 오늘치 전체를 읽으면 전국 휴게소 하루 약 60만 행이라 서버에서 3~4초 (2026-11-24).
# 시간대마다 해시 하나: 충전기별 "충전소|충전기" 필드 + 합계 HOUR_TOTAL_FIELD, 값은 "충전 중,분모"
HOUR_CACHE_KEY = "admin:occ-hour:v1:{target}:{day}:{hour:02d}"
HOUR_CACHE_TTL_SEC = 2 * 24 * 3600  # 오늘 · 자정 직후의 어제만 씀
# 합계 필드 - 관측이 없는 시간대도 이 필드가 남아 저장했다는 표시가 됨 (빈 해시는 Redis에 남지 않음)
HOUR_TOTAL_FIELD = "_"
# 오늘 끝난 시간대(0시 ~ upto-1시)의 충전기별 합 - 충전기 목록이 시간대 해시 23개(서울 · 휴게소 27만 값)를
# 요청마다 읽어 더하면 서버에서 2초 넘게 걸림 (2026-11-25). 필드 · 값은 시간대 해시와 같음.
# 시간대가 끝날 때마다 새 키가 생기므로 다음 시간대까지만 남김
CHARGER_SUM_CACHE_KEY = "admin:occ-charger-sum:v1:{target}:{day}:{upto:02d}"
CHARGER_SUM_CACHE_TTL_SEC = 2 * 3600
_redis = redis.Redis.from_url(settings.redis_url, socket_timeout=1, socket_connect_timeout=1)


def targets_of(region: str, district: str | None = None) -> list[str]:
    """집계 대상. 구를 고르면 그 구가 있는 대상 하나 (마포구는 city, 나머지는 live)"""
    if district is None:
        return REGION_TARGETS[region]
    # 구는 서울 안에서만 고름 - region=city면 마포구만 됨
    if region == "seoul" or (region == "city" and district == CITY_DISTRICT):
        return ["city" if district == CITY_DISTRICT else "live"]
    raise ApiError(422, "VALIDATION_ERROR", "요청 값이 올바르지 않습니다.")


def station_districts(db: Session, target: str) -> dict[str, str]:
    """충전소 → 구 코드 (city · live만). gugun은 주소 두 번째 단어라 표에 없으면 빠짐"""
    if target not in DISTRICT_TARGETS:
        return {}
    station = TARGETS[target][0]
    rows = db.execute(select(station.station_id, station.gugun))
    return {
        station_id: DISTRICT_CODES[gugun] for station_id, gugun in rows if gugun in DISTRICT_CODES
    }


def by_district(fields: dict[str, tuple[int, int]], districts: dict[str, str]) -> dict:
    """충전기 필드("충전소|충전기") 값을 구 코드로 묶어 더함 - 합계 HOUR_TOTAL_FIELD도 붙임"""
    sums: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for field, (charging, observed) in fields.items():
        if field == HOUR_TOTAL_FIELD:
            continue
        sums[HOUR_TOTAL_FIELD][0] += charging
        sums[HOUR_TOTAL_FIELD][1] += observed
        district = districts.get(field.split("|", 1)[0])
        if district:
            sums[district][0] += charging
            sums[district][1] += observed
    return {key: tuple(value) for key, value in sums.items()} or {HOUR_TOTAL_FIELD: (0, 0)}


def kst_today(now: datetime) -> date:
    return now.astimezone(KST).date()


def day_start(day: date) -> datetime:
    return datetime.combine(day, time(), tzinfo=KST)


def hour_start(day: date, hour: int) -> datetime:
    return datetime.combine(day, time(hour), tzinfo=KST)


def charger_field(station_id: str, charger_id: str) -> str:
    return f"{station_id}|{charger_id}"


def ratio(part: int, whole: int) -> float | None:
    return round(part / whole, 4) if whole else None


def log_counts(db: Session, target: str, start: datetime, end: datetime, group: str) -> dict:
    """[start, end)에 시작한 성공 회차의 상태 로그(버스전용 제외)를 group별로 셈 -
    (충전 중 수, 이용률 분모). group: date(KST 날짜) · date_station((KST 날짜, 충전소)) ·
    hour_charger((KST 시 0~23, 충전소, 충전기))"""
    _, charger, log = TARGETS[target]
    kst = func.timezone(KST_ZONE, CollectionRun.started_at)
    keys = {
        "date": [func.date(kst)],
        "date_station": [func.date(kst), log.station_id],
        "hour_charger": [cast(extract("hour", kst), Integer), log.station_id, log.charger_id],
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


def hourly_log_counts(
    db: Session,
    target: str,
    day: date,
    now: datetime,
    by_charger: bool = False,
    before_hour: int = 24,
) -> dict[int, dict[str, tuple[int, int]]]:
    """day(KST)에서 now 전에 시작한 시간대(before_hour시 전까지)별 log_counts - {시: {필드: (충전 중, 분모)}}.
    필드는 합계 HOUR_TOTAL_FIELD와 충전기별 charger_field. by_charger가 아니면 Redis에서 합계만 읽음
    (DB에서 센 시간대는 충전기별 필드도 들어 있음). 끝난 시간대는 Redis에 저장해 두고 씀 -
    Redis 장애면 DB에서 바로 셈"""
    hours = [h for h in range(before_hour) if hour_start(day, h) < now]
    keys = {h: HOUR_CACHE_KEY.format(target=target, day=day.isoformat(), hour=h) for h in hours}
    counts: dict[int, dict[str, tuple[int, int]]] = {}
    try:
        pipe = _redis.pipeline()
        for hour in hours:
            if by_charger:
                pipe.hgetall(keys[hour])
            else:
                pipe.hget(keys[hour], HOUR_TOTAL_FIELD)
        for hour, raw in zip(hours, pipe.execute(), strict=True):
            if not raw:
                continue
            fields = raw if by_charger else {HOUR_TOTAL_FIELD.encode(): raw}
            counts[hour] = {
                field.decode(): tuple(int(v) for v in value.decode().split(","))
                for field, value in fields.items()
            }
    except redis.RedisError:
        logger.warning("Redis 오류 - 시간대별 집계를 DB에서 바로 계산", exc_info=True)

    missing = [h for h in hours if h not in counts]
    if not missing:
        return counts
    # 빠진 시간대의 처음 ~ 끝을 한 번에 셈. 끝난 시간대는 한 번에 함께 저장하므로 보통은 끝쪽 한두 시간만 빠짐
    end = min(hour_start(day, missing[-1]) + timedelta(hours=1), now)
    computed: dict[int, dict[str, tuple[int, int]]] = defaultdict(dict)
    for (hour, station_id, charger_id), value in log_counts(
        db, target, hour_start(day, missing[0]), end, "hour_charger"
    ).items():
        computed[hour][charger_field(station_id, charger_id)] = value
    for hour in missing:
        fields = computed[hour]
        fields[HOUR_TOTAL_FIELD] = (
            sum(c for c, _ in fields.values()),
            sum(o for _, o in fields.values()),
        )
        counts[hour] = fields

    closed = [
        h for h in missing if hour_start(day, h) + timedelta(hours=1) + DAY_CLOSED_AFTER <= now
    ]
    if closed:
        try:
            pipe = _redis.pipeline()
            for hour in closed:
                mapping = {field: f"{c},{o}" for field, (c, o) in counts[hour].items()}
                pipe.hset(keys[hour], mapping=mapping)
                pipe.expire(keys[hour], HOUR_CACHE_TTL_SEC)
            pipe.execute()
        except redis.RedisError:
            logger.warning("Redis 오류 - 시간대별 집계를 저장하지 못함", exc_info=True)
    return counts


def closed_hours(day: date, now: datetime) -> int:
    """day(KST)에서 끝나 저장할 수 있는 시간대 수 - 0시부터 이어지므로 0 ~ 그 수-1시"""
    return sum(
        1 for h in range(24) if hour_start(day, h) + timedelta(hours=1) + DAY_CLOSED_AFTER <= now
    )


def closed_charger_sums(
    db: Session, target: str, day: date, now: datetime
) -> tuple[int, dict[str, tuple[int, int]]]:
    """day에서 끝난 시간대의 충전기별 합 - (끝난 시간대 수 upto, {필드: (충전 중, 분모)}).
    한 번 더한 값은 CHARGER_SUM_CACHE_KEY에 저장해 시간대가 끝날 때까지 그대로 씀"""
    upto = closed_hours(day, now)
    if not upto:
        return 0, {}
    key = CHARGER_SUM_CACHE_KEY.format(target=target, day=day.isoformat(), upto=upto)
    try:
        raw = _redis.hgetall(key)
        if raw:
            return upto, {
                field.decode(): tuple(int(v) for v in value.decode().split(","))
                for field, value in raw.items()
            }
    except redis.RedisError:
        logger.warning("Redis 오류 - 충전기별 오늘 합을 시간대별 집계로 계산", exc_info=True)

    sums: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for fields in hourly_log_counts(
        db, target, day, now, by_charger=True, before_hour=upto
    ).values():
        for field, (charging, observed) in fields.items():
            sums[field][0] += charging
            sums[field][1] += observed
    # 시간대 합계 HOUR_TOTAL_FIELD를 더한 값이 함께 남아 관측이 없어도 저장 표시가 됨
    counts = {field: (c, o) for field, (c, o) in sums.items()} or {HOUR_TOTAL_FIELD: (0, 0)}
    try:
        pipe = _redis.pipeline()
        pipe.hset(key, mapping={field: f"{c},{o}" for field, (c, o) in counts.items()})
        pipe.expire(key, CHARGER_SUM_CACHE_TTL_SEC)
        pipe.execute()
    except redis.RedisError:
        logger.warning("Redis 오류 - 충전기별 오늘 합을 저장하지 못함", exc_info=True)
    return upto, counts


def today_charger_counts(db: Session, target: str, now: datetime) -> dict[str, tuple[int, int]]:
    """충전기별 오늘 합 {charger_field: (충전 중, 분모)} - 끝난 시간대의 합(Redis)에
    아직 저장하지 않은 시간대만 DB에서 세어 더함"""
    day = kst_today(now)
    upto, closed = closed_charger_sums(db, target, day, now)
    counts = dict(closed)
    counts.pop(HOUR_TOTAL_FIELD, None)
    if hour_start(day, upto) < now:
        for (_, station_id, charger_id), (c, o) in log_counts(
            db, target, hour_start(day, upto), now, "hour_charger"
        ).items():
            field = charger_field(station_id, charger_id)
            charging, observed = counts.get(field, (0, 0))
            counts[field] = (charging + c, observed + o)
    return counts


def daily_log_counts(db: Session, target: str, days: list[date], now: datetime) -> dict:
    """날짜별 log_counts. days는 오름차순. 끝난 날은 Redis에 저장해 두고 씀 -
    Redis 장애면 DB에서 바로 셈. 안 끝난 날(오늘 · 자정 직후의 어제)은 시간대별 합계를 더함"""
    keys = [DAY_CACHE_KEY.format(target=target, day=d.isoformat()) for d in days]
    counts: dict[date, tuple[int, int]] = {}
    try:
        for day, raw in zip(days, _redis.mget(keys), strict=True):
            if raw is not None:
                counts[day] = tuple(int(v) for v in raw.decode().split(","))
    except redis.RedisError:
        logger.warning("Redis 오류 - 일별 집계를 DB에서 바로 계산", exc_info=True)

    missing = [d for d in days if d not in counts]
    closed = [d for d in missing if day_start(d + timedelta(days=1)) + DAY_CLOSED_AFTER <= now]
    for day in missing:
        if day not in closed:
            hours = hourly_log_counts(db, target, day, now).values()
            counts[day] = (
                sum(h[HOUR_TOTAL_FIELD][0] for h in hours),
                sum(h[HOUR_TOTAL_FIELD][1] for h in hours),
            )
    if closed:
        computed = log_counts(
            db, target, day_start(closed[0]), day_start(closed[-1] + timedelta(days=1)), "date"
        )
        for day in closed:
            counts[day] = computed.get(day, (0, 0))
        try:
            pipe = _redis.pipeline()
            for day in closed:
                key = DAY_CACHE_KEY.format(target=target, day=day.isoformat())
                pipe.set(key, ",".join(map(str, counts[day])), ex=DAY_CACHE_TTL_SEC)
            pipe.execute()
        except redis.RedisError:
            logger.warning("Redis 오류 - 일별 집계를 저장하지 못함", exc_info=True)
    return counts


def daily_district_counts(
    db: Session, target: str, days: list[date], now: datetime
) -> dict[date, dict[str, tuple[int, int]]]:
    """날짜별 구별 집계 {날짜: {구 코드: (충전 중, 분모)}} - daily_log_counts와 같은 규칙.
    끝난 날은 충전소별로 세어 구로 묶은 뒤 Redis 해시에 저장, 안 끝난 날은 시간대별 충전기 값을 구로 묶음.
    구로 바로 묶지 않는 이유: 충전소 표와 조인하면 휴게소 때처럼 흩어 읽음 (log_counts 주석)"""
    keys = [DISTRICT_DAY_CACHE_KEY.format(target=target, day=d.isoformat()) for d in days]
    counts: dict[date, dict[str, tuple[int, int]]] = {}
    try:
        pipe = _redis.pipeline()
        for key in keys:
            pipe.hgetall(key)
        for day, raw in zip(days, pipe.execute(), strict=True):
            if raw:
                counts[day] = {
                    field.decode(): tuple(int(v) for v in value.decode().split(","))
                    for field, value in raw.items()
                }
    except redis.RedisError:
        logger.warning("Redis 오류 - 구별 일별 집계를 DB에서 바로 계산", exc_info=True)

    missing = [d for d in days if d not in counts]
    if not missing:
        return counts
    districts = station_districts(db, target)
    closed = [d for d in missing if day_start(d + timedelta(days=1)) + DAY_CLOSED_AFTER <= now]
    for day in missing:
        if day not in closed:
            fields: dict[str, tuple[int, int]] = defaultdict(lambda: (0, 0))
            for hour in hourly_log_counts(db, target, day, now, by_charger=True).values():
                for key, (c, o) in by_district(hour, districts).items():
                    fields[key] = (fields[key][0] + c, fields[key][1] + o)
            counts[day] = dict(fields)
    if closed:
        by_day: dict[date, dict[str, tuple[int, int]]] = defaultdict(dict)
        for (day, station_id), value in log_counts(
            db,
            target,
            day_start(closed[0]),
            day_start(closed[-1] + timedelta(days=1)),
            "date_station",
        ).items():
            by_day[day][f"{station_id}|"] = value
        for day in closed:
            counts[day] = by_district(by_day[day], districts)
        try:
            pipe = _redis.pipeline()
            for day in closed:
                key = DISTRICT_DAY_CACHE_KEY.format(target=target, day=day.isoformat())
                pipe.hset(key, mapping={f: f"{c},{o}" for f, (c, o) in counts[day].items()})
                pipe.expire(key, DAY_CACHE_TTL_SEC)
            pipe.execute()
        except redis.RedisError:
            logger.warning("Redis 오류 - 구별 일별 집계를 저장하지 못함", exc_info=True)
    return counts


def warm_charger_sums(db: Session, target: str, days: list[date], now: datetime) -> None:
    """warm_cache 작업 - 오늘(days 마지막)의 충전기별 끝난 시간대 합을 저장"""
    closed_charger_sums(db, target, days[-1], now)


def warm_cache(db: Session, now: datetime | None = None) -> None:
    """이용률 집계를 화면 요청 전에 Redis에 채움 - collector가 매시 끝난 시간대 뒤에 부름.
    끝난 날(4주)과 오늘의 끝난 시간대가 저장돼 화면을 처음 연 사람도 진행 중인 시간대만 기다림.
    대상 하나가 실패해도 나머지는 채움"""
    now = now or datetime.now(UTC)
    today = kst_today(now)
    days = [today - timedelta(days=i) for i in range(UTILIZATION_DAYS - 1, -1, -1)]
    for target in TARGETS:
        # 오늘은 안 끝난 날이라 hourly_log_counts로 시간대별 저장까지 함. 서울은 구별 날짜 집계도 채움.
        # 충전기 목록의 오늘 합은 시간대별 저장 뒤에 더함
        jobs = [daily_log_counts]
        if target in DISTRICT_TARGETS:
            jobs.append(daily_district_counts)
        jobs.append(warm_charger_sums)
        for job in jobs:
            try:
                job(db, target, days, now)
            except Exception:
                db.rollback()
                logger.exception("운영자 집계 미리 계산 실패 [%s · %s]", target, job.__name__)


def get_utilization(
    db: Session,
    region: str,
    period: str,
    now: datetime | None = None,
    district: str | None = None,
) -> UtilizationResponse:
    now = now or datetime.now(UTC)
    today = kst_today(now)
    targets = targets_of(region, district)
    totals: dict[int, list[int]] = defaultdict(lambda: [0, 0])
    if period == "day":
        start = day_start(today)
        buckets = [(hour, f"{hour}시") for hour in range(24)]
        for target in targets:
            if district:
                # 구는 시간대별 충전기 값을 구로 묶음 - 끝난 시간대는 Redis에서 읽어 DB 부담이 없음
                districts = station_districts(db, target)
                hours = {
                    hour: by_district(fields, districts)
                    for hour, fields in hourly_log_counts(
                        db, target, today, now, by_charger=True
                    ).items()
                }
            else:
                hours = hourly_log_counts(db, target, today, now)
            for hour, fields in hours.items():
                charging, observed = fields.get(district or HOUR_TOTAL_FIELD, (0, 0))
                totals[hour][0] += charging
                totals[hour][1] += observed
    else:
        days = [today - timedelta(days=i) for i in range(UTILIZATION_DAYS - 1, -1, -1)]
        start = day_start(days[0])
        buckets = list(enumerate(WEEKDAY_LABELS))
        for target in targets:
            if district:
                daily = {
                    day: fields.get(district, (0, 0))
                    for day, fields in daily_district_counts(db, target, days, now).items()
                }
            else:
                daily = daily_log_counts(db, target, days, now)
            for day, (charging, observed) in daily.items():
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
        district=district,
        period=period,
        from_=start,
        to=now,
        average_occupancy_rate=ratio(
            sum(c for c, _ in totals.values()), sum(o for _, o in totals.values())
        ),
        series=series,
    )


def get_chargers(
    db: Session, region: str, now: datetime | None = None, district: str | None = None
) -> AdminChargersResponse:
    now = now or datetime.now(UTC)
    chargers: list[AdminCharger] = []
    updated: list[datetime] = []
    for target in targets_of(region, district):
        station_model, charger_model, log_model = TARGETS[target]
        run = latest_success_run(db, target)  # 수집 기록이 없으면 503
        updated.append(run.started_at)
        states = load_charger_states(db, charger_model, log_model, run, now)
        stations = list(
            db.scalars(select(station_model).where(station_model.station_id.in_(list(states))))
        )
        if target == "service_area":
            # HY E-pit 이중 등록은 상태가 늘 stat 9라 상태 이상으로 잘못 셈 - 사용자 휴게소 API(#217)와 같이 뺌
            stations = without_duplicates(db, stations, states)
            kept = {s.station_id for s in stations}
            states = {sid: cs for sid, cs in states.items() if sid in kept}
        names = {
            s.station_id: (s.service_area_name or s.name if target == "service_area" else s.name)
            or s.station_id
            for s in stations
        }
        districts = station_districts(db, target)
        if district:
            states = {sid: cs for sid, cs in states.items() if districts.get(sid) == district}
        today = today_charger_counts(db, target, now)
        for station_id, station_chargers in states.items():
            for c in station_chargers:
                charger_today = today.get(charger_field(station_id, c.charger_id), (0, 0))
                chargers.append(
                    AdminCharger(
                        region=target,
                        station_id=station_id,
                        station_name=names[station_id],
                        district=districts.get(station_id),
                        district_name=SEOUL_DISTRICTS.get(districts.get(station_id)),
                        charger_id=c.charger_id,
                        status=c.status,
                        stat=c.stat,
                        unstable=c.unstable,
                        today_occupancy_rate=ratio(*charger_today),
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
