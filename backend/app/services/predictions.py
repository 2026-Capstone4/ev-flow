"""충전소 예측 조회 - Redis pred:v1(모델) → baseline:v1(요일 · 시간대 기준선) → null 순 (docs/prediction.md, AI-07)

api는 Redis만 읽음. Redis 장애는 예측을 비우는 데서 끝내고 조회 API 자체는 실패시키지 않음
"""
import json
import logging
import time
from datetime import datetime, timedelta

import redis

from app.config import settings
from app.schemas.base import KST
from app.schemas.station import Prediction

logger = logging.getLogger(__name__)

PRED_KEY = "pred:v1"
BASELINE_KEY = "baseline:v1"
HORIZONS = (15, 30, 60)
BASELINE_CACHE_SEC = 600  # 기준선은 하루 한 번 바뀜 - 요청마다 읽지 않게 워커 메모리에 둠

# 연결은 첫 명령 때 맺음. 타임아웃을 짧게 - Redis가 죽어도 조회 API가 오래 붙잡히지 않게 함
_redis = redis.Redis.from_url(settings.redis_url, socket_timeout=1, socket_connect_timeout=1)
_baseline_cache: tuple[float, dict] | None = None  # (읽은 시각 monotonic, 충전소별 168칸)


def baseline_slot(at: datetime) -> int:
    """기준선 칸 번호 - KST 요일(월=0) × 24 + 시. collector 계산과 api 조회가 같은 함수를 씀"""
    local = at.astimezone(KST)
    return local.weekday() * 24 + local.hour


def _get_json(key: str):
    raw = _redis.get(key)
    return None if raw is None else json.loads(raw)


def load_model_predictions() -> dict | None:
    """pred:v1의 충전소별 예측. 키가 없거나(만료 · ml 미준비) 읽지 못하면 None"""
    try:
        value = _get_json(PRED_KEY)
    except Exception:
        logger.warning("pred:v1 읽기 실패 - 기준선으로 대체", exc_info=True)
        return None
    return value["stations"] if value else None


def load_baseline() -> dict | None:
    global _baseline_cache
    now = time.monotonic()
    if _baseline_cache and now - _baseline_cache[0] < BASELINE_CACHE_SEC:
        return _baseline_cache[1]
    try:
        value = _get_json(BASELINE_KEY)
    except Exception:
        logger.warning("baseline:v1 읽기 실패 - 직전 캐시 사용", exc_info=True)
        return _baseline_cache[1] if _baseline_cache else None
    if value is None:
        # 없음은 캐시하지 않음 - collector가 다시 만들면 다음 요청부터 바로 씀
        return None
    _baseline_cache = (now, value["stations"])
    return _baseline_cache[1]


def _round_wait(minutes: float) -> int:
    # collector 검증으로 0 이상만 들어옴. round()는 2.5 → 2(은행원 반올림)라 쓰지 않음
    return int(minutes + 0.5)


def build_predictions(station_id: str, quality: str, model: dict | None, baseline: dict | None,
                      now: datetime) -> list[Prediction]:
    """충전소 하나의 15 · 30 · 60분 예측 (docs/prediction.md api 조회 규칙)"""
    preds = model.get(station_id) if model and quality != "baseline" else None
    if preds:
        return [
            Prediction(horizon_minutes=p["horizon"], congestion=p["congestion"],
                       wait_time_p50_minutes=_round_wait(p["wait_p50"]),
                       wait_time_p90_minutes=_round_wait(p["wait_p90"]), source="model")
            for p in preds
        ]
    # 기준선은 혼잡도만 있음 - 대기시간 기준선은 정하지 않아 null
    slots = baseline.get(station_id) if baseline else None
    result = []
    for h in HORIZONS:
        congestion = slots[baseline_slot(now + timedelta(minutes=h))] if slots else None
        result.append(Prediction(horizon_minutes=h, congestion=congestion, wait_time_p50_minutes=None,
                                 wait_time_p90_minutes=None, source="baseline" if congestion else None))
    return result
