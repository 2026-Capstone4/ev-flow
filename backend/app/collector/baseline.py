"""요일 · 시간대 기준선 - 최근 28일 도심 회차로 충전소 × 요일 × 시의 최빈 혼잡도를 Redis baseline:v1에 저장
(docs/prediction.md 기준선, UC-U04 2b · UC-U05 2a)

예측이 없거나(pred:v1 만료 · ml 미준비) 충전소 dataQuality가 baseline일 때 api가 대신 보여줌.
실패는 여기서 모두 삼킴 - 수집에 영향을 주면 안 됨
"""
import json
import logging
import threading
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

import redis
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import CityCharger, CityStatusLog, CollectionRun
from app.db.session import SessionLocal
from app.services.predictions import BASELINE_KEY, baseline_slot
from app.services.status import BUS_CHARGER_TYPE, STAT_TO_STATUS, congestion_from_counts

logger = logging.getLogger(__name__)

WINDOW = timedelta(days=28)  # 요일마다 4번
BASELINE_TTL_SEC = 3 * 24 * 3600  # 하루 한 번 갱신 - 이틀 연속 실패해도 남음
MIN_SAMPLES = 12  # 칸 하나에 최대 48회차(4주 × 시간당 12회) - 이보다 적으면 비움
SLOTS = 7 * 24
# 동률이면 뒤쪽(혼잡한 쪽) - 한산하다고 안내했다가 헛걸음하게 하는 쪽을 피함
LEVELS = ("low", "medium", "high")

# 상태 코드 묶음은 현재 혼잡도와 같은 표(STAT_TO_STATUS)에서 만듦
STATS_CONFIRMED = list(STAT_TO_STATUS)
STATS_AVAILABLE = [s for s, v in STAT_TO_STATUS.items() if v == "available"]
STATS_CHARGING = [s for s, v in STAT_TO_STATUS.items() if v == "charging"]

_redis = redis.Redis.from_url(settings.redis_url, socket_timeout=5, socket_connect_timeout=5)
_lock = threading.Lock()  # 시작 시 실행과 첫 수집의 키 확인이 겹치면 한 번만 계산


def load_totals(db: Session) -> dict[str, int]:
    """충전소별 버스전용을 뺀 충전기 수 - 현재 혼잡도의 분모와 같음"""
    charger = CityCharger
    query = (
        select(charger.station_id, func.count())
        .where(charger.charger_type != BUS_CHARGER_TYPE)
        .group_by(charger.station_id)
    )
    return dict(db.execute(query).all())


def load_counts(db: Session, since: datetime):
    """(충전소, 시각(정시), 확인 · 사용 가능 · 충전 중 수, 회차 수) - 같은 개수 조합은 SQL에서 합침.
    정시 자르기는 UTC 기준이지만 KST가 정수 시간 차이라 KST 정시와 같음"""
    run, log, charger = CollectionRun, CityStatusLog, CityCharger
    per_run = (
        select(
            run.started_at,
            log.station_id,
            func.count().filter(log.stat.in_(STATS_CONFIRMED)).label("confirmed"),
            func.count().filter(log.stat.in_(STATS_AVAILABLE)).label("available"),
            func.count().filter(log.stat.in_(STATS_CHARGING)).label("charging"),
        )
        .select_from(run)
        .join(log, log.collection_run_id == run.id)
        .join(charger, and_(charger.station_id == log.station_id, charger.charger_id == log.charger_id))
        # 실행 id로 고름 - collection_runs 도입 이전 FAILED 회차도 행을 남겼음 (snapshot.py와 같은 이유)
        .where(run.target == "city", run.status.in_(("SUCCESS", "PARTIAL")), run.started_at >= since,
               log.collected_at >= since, charger.charger_type != BUS_CHARGER_TYPE)
        .group_by(run.id, run.started_at, log.station_id)
        .subquery()
    )
    p = per_run.c
    hour = func.date_trunc("hour", p.started_at).label("hour")
    query = (
        select(p.station_id, hour, p.confirmed, p.available, p.charging, func.count().label("n"))
        .group_by(p.station_id, hour, p.confirmed, p.available, p.charging)
    )
    return db.execute(query).all()


def build_slots(rows, totals: dict[str, int]) -> dict[str, list]:
    """충전소별 168칸(baseline_slot 순서). unknown · unavailable 회차는 표본에서 뺌. 값이 하나도 없는 충전소는 넣지 않음"""
    counts: dict[tuple[str, int], Counter] = defaultdict(Counter)
    for r in rows:
        total = totals.get(r.station_id)
        if not total:
            continue
        level = congestion_from_counts(total, r.confirmed, r.available, r.charging)
        if level in LEVELS:
            counts[(r.station_id, baseline_slot(r.hour))][level] += r.n
    stations: dict[str, list] = {}
    for (station_id, slot), c in counts.items():
        if sum(c.values()) < MIN_SAMPLES:
            continue
        slots = stations.setdefault(station_id, [None] * SLOTS)
        slots[slot] = max(LEVELS, key=lambda lv: (c[lv], LEVELS.index(lv)))
    return stations


def refresh_baseline() -> None:
    """매일 04:00 · collector 시작 시 · 키가 없을 때 실행 (scheduler.py)"""
    if not _lock.acquire(blocking=False):
        return
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        since = now - WINDOW
        stations = build_slots(load_counts(db, since), load_totals(db))
        if not stations:
            # 수집 초기처럼 표본이 모자람 - 기존 값이 있으면 그대로 둠
            logger.warning("기준선 갱신 건너뜀 - 표본 %d회차 이상인 칸이 없음", MIN_SAMPLES)
            return
        value = {"created_at": now.isoformat(), "since": since.isoformat(), "stations": stations}
        _redis.set(BASELINE_KEY, json.dumps(value), ex=BASELINE_TTL_SEC)
        filled = sum(v is not None for slots in stations.values() for v in slots)
        logger.info("기준선 저장 - %d개소 · %d/%d칸", len(stations), filled, len(stations) * SLOTS)
    except Exception:
        logger.exception("기준선 갱신 실패 - 기존 baseline:v1 유지")
    finally:
        db.close()
        _lock.release()


def ensure_baseline() -> None:
    """키가 없으면 다시 만듦 - redis에 볼륨이 없어 컨테이너를 다시 만들면 키가 사라짐. 도심 수집마다 확인"""
    try:
        if _redis.exists(BASELINE_KEY):
            return
    except Exception:
        logger.warning("baseline:v1 확인 실패 - 다음 회차에 다시 확인", exc_info=True)
        return
    refresh_baseline()
