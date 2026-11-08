"""도심 수집 직후 ml 예측을 받아 Redis pred:v1에 저장 (docs/prediction.md, AI-07)

예측 단계의 실패는 여기서 모두 삼킴 - 이미 커밋한 수집 결과 · 수집 실행 기록에 영향을 주면 안 됨
"""
import json
import logging
import math
from datetime import datetime, timedelta, timezone

import httpx
import redis
from sqlalchemy import select, true
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import CityCharger, CityStatusLog, CollectionRun
from app.services.status import BUS_CHARGER_TYPE

logger = logging.getLogger(__name__)

PRED_KEY = "pred:v1"
PRED_TTL_SEC = 1200  # 20분 - 4회차 연속 갱신이 안 되면 만료돼 api가 기준선으로 대체함
ML_TIMEOUT_SEC = 10
HISTORY = timedelta(hours=3)  # 🟡 ml에 넘길 상태 기간 - AI 팀 피처 코드에 따라 정함 (AI-03)
HORIZONS = [15, 30, 60]
CONGESTIONS = {"low", "medium", "high"}

# 연결은 첫 명령 때 맺음 - redis가 꺼져 있어도 collector 기동은 막지 않음
_redis = redis.Redis.from_url(settings.redis_url, socket_timeout=5, socket_connect_timeout=5)


def load_history(db: Session, since: datetime) -> list[dict]:
    """버스전용을 뺀 도심 충전기의 since 이후 상태 로그.
    충전기마다 인덱스(station_id, charger_id, collected_at) 범위만 읽음 - 시각 조건만 걸면 테이블 전체를 훑음"""
    charger, log = CityCharger, CityStatusLog
    recent = (
        select(log.collected_at, log.stat)
        .where(log.station_id == charger.station_id, log.charger_id == charger.charger_id, log.collected_at >= since)
        .lateral()
    )
    query = (
        select(charger.station_id, charger.charger_id, recent.c.collected_at, recent.c.stat)
        .join(recent, true())
        .where(charger.charger_type != BUS_CHARGER_TYPE)
        .order_by(charger.station_id, charger.charger_id, recent.c.collected_at)
    )
    return [
        {"station_id": r.station_id, "charger_id": r.charger_id,
         "collected_at": r.collected_at.isoformat(), "stat": r.stat}
        for r in db.execute(query)
    ]


def _is_wait(value) -> bool:
    # bool은 int의 하위 타입이라 따로 막음. NaN · 무한대는 JSON에 쓸 수 없음
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0


def valid_predictions(preds) -> list[dict] | None:
    """한 충전소의 예측이 규칙에 맞으면 15 · 30 · 60 순서로 정리해 돌려줌, 아니면 None"""
    if not isinstance(preds, list) or len(preds) != len(HORIZONS):
        return None
    cleaned = []
    for p in preds:
        if not isinstance(p, dict) or p.get("horizon") not in HORIZONS or p.get("congestion") not in CONGESTIONS:
            return None
        p50, p90 = p.get("wait_p50"), p.get("wait_p90")
        if not (_is_wait(p50) and _is_wait(p90) and p50 <= p90):
            return None
        cleaned.append({"horizon": p["horizon"], "congestion": p["congestion"], "wait_p50": p50, "wait_p90": p90})
    cleaned.sort(key=lambda p: p["horizon"])
    return cleaned if [p["horizon"] for p in cleaned] == HORIZONS else None


def build_value(body, targets: set[str], base_time: datetime, run_id: int, now: datetime) -> tuple[dict, int]:
    """ml 응답 → (pred:v1 값, 검증에서 뺀 충전소 수). 저장할 충전소가 없으면 ValueError"""
    if not isinstance(body, dict) or not isinstance(body.get("stations"), dict) or not body.get("model_version"):
        raise ValueError("ml 응답 형식이 맞지 않음")
    stations = {}
    for station_id, preds in body["stations"].items():
        cleaned = valid_predictions(preds) if station_id in targets else None
        if cleaned is not None:
            stations[station_id] = cleaned
    if not stations:
        raise ValueError("검증을 통과한 충전소 없음")
    value = {
        "base_time": base_time.isoformat(),
        "collection_run_id": run_id,
        "model_version": str(body["model_version"]),
        "created_at": now.isoformat(),
        "stations": stations,
    }
    return value, len(body["stations"]) - len(stations)


def refresh_predictions(db: Session, run: CollectionRun) -> None:
    try:
        base_time, run_id = run.started_at, run.id
        rows = load_history(db, base_time - HISTORY)
        targets = {r["station_id"] for r in rows}
        resp = httpx.post(
            f"{settings.ml_url}/predict",
            json={"base_time": base_time.isoformat(), "rows": rows},
            timeout=ML_TIMEOUT_SEC,
        )
        if resp.status_code == 503:
            # 모델 · 피처 코드가 없는 동안은 매 회차 여기로 옴 - 정상 상황이라 INFO
            logger.info("예측 건너뜀 - ml 준비 안 됨 (%s)", resp.text[:200])
            return
        resp.raise_for_status()
        value, dropped = build_value(resp.json(), targets, base_time, run_id, datetime.now(timezone.utc))
        _redis.set(PRED_KEY, json.dumps(value, ensure_ascii=False), ex=PRED_TTL_SEC)
        logger.info("예측 저장 - %d개소 (검증 제외 %d, 모델 %s)", len(value["stations"]), dropped, value["model_version"])
    except Exception:
        # 기존 pred:v1 · TTL은 그대로 - api는 남은 예측을 쓰다가 만료되면 기준선으로 대체함
        logger.exception("예측 갱신 실패 - 기존 pred:v1 유지")
