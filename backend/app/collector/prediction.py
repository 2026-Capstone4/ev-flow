"""도심 수집 직후 ml 예측을 받아 Redis pred:v2에 저장 (docs/prediction.md, AI-07)

ml은 AI 패키지(backend_app)를 그대로 실행함 - 회차 번호만 보내면 ml이 ml_read · ml_checkpoint를 직접 읽음.
예측 단계의 실패는 여기서 모두 삼킴 - 이미 커밋한 수집 결과 · 수집 실행 기록에 영향을 주면 안 됨
"""

import json
import logging
import math
from datetime import UTC, datetime

import httpx
import redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import CityCharger, CollectionRun
from app.services.status import BUS_CHARGER_TYPE

logger = logging.getLogger(__name__)

PRED_KEY = "pred:v2"
PRED_TTL_SEC = 1200  # 20분 - 4회차 연속 갱신이 안 되면 만료돼 api가 기준선으로 대체함
PREDICT_PATH = "/internal/v1/predict"
# AI 실측(512MiB · 체크포인트 있음) 약 7.4초 - 첫 요청 · 서버 부하를 감안해 여유를 둠. 수집 주기는 5분
ML_TIMEOUT_SEC = 30
HORIZONS = [15, 30]
# AI 패키지의 혼잡도 단계 → 응답 값 (패키지는 한국어 · 영어 둘 다 낼 수 있음)
CONGESTIONS = {
    "여유": "low",
    "보통": "medium",
    "혼잡": "high",
    "free": "low",
    "moderate": "medium",
    "congested": "high",
}

# 연결은 첫 명령 때 맺음 - redis가 꺼져 있어도 collector 기동은 막지 않음
_redis = redis.Redis.from_url(settings.redis_url, socket_timeout=5, socket_connect_timeout=5)


def load_targets(db: Session) -> set[str]:
    """예측을 저장할 수 있는 충전소 - 버스전용이 아닌 충전기가 1기 이상인 도심 충전소"""
    query = (
        select(CityCharger.station_id)
        .where(CityCharger.charger_type != BUS_CHARGER_TYPE)
        .distinct()
    )
    return set(db.scalars(query))


def _is_number(value) -> bool:
    # bool은 int의 하위 타입이라 따로 막음. NaN · 무한대는 JSON에 쓸 수 없음
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _ratio(value) -> float | None:
    return float(value) if _is_number(value) and 0 <= value <= 1 else None


def convert_row(row) -> dict | None:
    """ml 응답의 충전소 × 시점 한 행 → pred:v2 한 칸. 혼잡도가 없으면 None

    대기는 혼잡도와 따로 빠질 수 있음(체크포인트 없음 등) - 그때는 혼잡도만 두고 대기는 null
    """
    if not isinstance(row, dict) or not isinstance(row.get("components"), dict):
        return None
    congestion = row["components"].get("congestion")
    if not isinstance(congestion, dict) or congestion.get("status") != "ok":
        return None
    label = CONGESTIONS.get(congestion.get("congestion_level"))
    if label is None:
        return None

    p50 = p90 = None
    time = row["components"].get("time")
    if isinstance(time, dict) and time.get("status") == "ok":
        a, b = time.get("p50_minutes"), time.get("p90_minutes")
        if _is_number(a) and _is_number(b) and 0 <= a <= b:
            p50, p90 = float(a), float(b)

    return {
        "horizon": row.get("horizon_minutes"),
        "congestion": label,
        "wait_p50": p50,
        "wait_p90": p90,
        # 추천 점수용 (점유율 · 만차 확률, 0 ~ 1) - 조회 API에는 아직 내보내지 않음
        "occupancy": _ratio(congestion.get("occupancy")),
        "congestion_prob": _ratio(congestion.get("congestion_prob")),
    }


def build_value(
    body, targets: set[str], base_time: datetime, run_id: int, now: datetime
) -> tuple[dict, int]:
    """ml 응답 → (pred:v2 값, 검증에서 뺀 충전소 수). 저장할 충전소가 없으면 ValueError

    충전소는 15 · 30분 혼잡도가 모두 있을 때만 넣음 - 하나라도 없으면 api가 그 충전소를 기준선으로 대체함
    """
    deployment = body.get("deployment") if isinstance(body, dict) else None
    if (
        not isinstance(body.get("predictions") if isinstance(body, dict) else None, list)
        or not isinstance(deployment, dict)
        or not deployment.get("deployment_id")
    ):
        raise ValueError("ml 응답 형식이 맞지 않음")

    by_station: dict[str, list] = {}
    for row in body["predictions"]:
        station_id = row.get("station_id") if isinstance(row, dict) else None
        if isinstance(station_id, str):
            by_station.setdefault(station_id, []).append(convert_row(row))

    stations = {}
    for station_id, cells in by_station.items():
        if station_id not in targets or any(c is None for c in cells):
            continue
        cells.sort(key=lambda c: c["horizon"] if c["horizon"] in HORIZONS else -1)
        if [c["horizon"] for c in cells] == HORIZONS:  # 15 · 30이 정확히 하나씩
            stations[station_id] = cells
    if not stations:
        raise ValueError("검증을 통과한 충전소 없음")

    # 행마다 {"congestion": 혼잡 모델, "time": 대기 모델} - 예측이 빠진 쪽은 None이라 값이 있는 것을 모음
    versions = {"congestion": None, "time": None}
    for row in body["predictions"]:
        row_versions = row.get("model_versions") if isinstance(row, dict) else None
        if isinstance(row_versions, dict):
            for part in versions:
                versions[part] = versions[part] or row_versions.get(part)

    value = {
        "base_time": base_time.isoformat(),
        "collection_run_id": run_id,
        # 패키지 배포 이름 하나로 혼잡 · 대기 모델 조합을 가리킴 - 각각의 버전은 model_versions
        "model_version": str(deployment["deployment_id"]),
        "model_versions": versions,
        "created_at": now.isoformat(),
        "stations": stations,
    }
    return value, len(by_station) - len(stations)


def refresh_predictions(db: Session, run: CollectionRun) -> None:
    try:
        targets = load_targets(db)
        resp = httpx.post(
            f"{settings.ml_url.rstrip('/')}{PREDICT_PATH}",
            json={"run_id": run.id},
            timeout=ML_TIMEOUT_SEC,
        )
        if resp.status_code != 200:
            # 503: 모델 로드 실패 · 모든 예측 불가 / 409: 회차 근거 불일치 / 404: 모르는 회차
            try:
                reason = resp.json().get("reason")
            except Exception:
                reason = resp.text[:200]
            logger.warning("예측 건너뜀 [run %d] - ml HTTP %d %s", run.id, resp.status_code, reason)
            return
        value, dropped = build_value(
            resp.json(), targets, run.started_at, run.id, datetime.now(UTC)
        )
        _redis.set(PRED_KEY, json.dumps(value, ensure_ascii=False), ex=PRED_TTL_SEC)
        waits = sum(
            1 for cells in value["stations"].values() for c in cells if c["wait_p50"] is not None
        )
        logger.info(
            "예측 저장 [run %d] - %d개소 (검증 제외 %d, 대기 있는 칸 %d, 모델 %s)",
            run.id,
            len(value["stations"]),
            dropped,
            waits,
            value["model_version"],
        )
    except Exception:
        # 기존 pred:v2 · TTL은 그대로 - api는 남은 예측을 쓰다가 만료되면 기준선으로 대체함
        logger.exception("예측 갱신 실패 - 기존 pred:v2 유지")
