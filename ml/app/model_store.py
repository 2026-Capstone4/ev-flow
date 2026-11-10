"""모델 6개(.ubj)를 컨테이너 시작 시 1회 로드 - 워커 1개 고정이라 프로세스당 하나 (AI-04)"""
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

import xgboost as xgb

logger = logging.getLogger(__name__)

MODEL_DIR = Path(os.getenv("MODEL_DIR", "/models"))
HORIZONS = (15, 30, 60)
VERSION_FILE = "VERSION"  # 모델 버전 한 줄 (예: 20261110)


# 🟡 파일 이름 규칙은 AI-01 미정 - 정해지면 이 두 함수만 바꿈
def congestion_file(horizon: int) -> str:
    return f"congestion_h{horizon}.ubj"


def wait_file(horizon: int) -> str:
    return f"wait_h{horizon}.ubj"


@dataclass
class ModelStore:
    congestion: dict[int, xgb.Booster] = field(default_factory=dict)
    wait: dict[int, xgb.Booster] = field(default_factory=dict)
    version: str | None = None
    error: str | None = None  # 로드 실패 사유 - /health로 확인

    @property
    def ready(self) -> bool:
        return len(self.congestion) == len(HORIZONS) and len(self.wait) == len(HORIZONS)


def _load(path: Path) -> xgb.Booster:
    booster = xgb.Booster()
    booster.load_model(path)
    return booster


def load_models(model_dir: Path = MODEL_DIR) -> ModelStore:
    """6개가 모두 있어야 사용함 - 일부만 있으면 시점마다 다른 버전이 섞일 수 있어 전부 쓰지 않음"""
    paths = [model_dir / name for h in HORIZONS for name in (congestion_file(h), wait_file(h))]
    missing = [p.name for p in paths if not p.exists()]
    if missing:
        logger.warning("모델 파일 없음 [%s] - 예측 요청에 503으로 응답함", ", ".join(missing))
        return ModelStore(error=f"모델 파일 없음: {', '.join(missing)}")

    store = ModelStore()
    try:
        for h in HORIZONS:
            store.congestion[h] = _load(model_dir / congestion_file(h))
            store.wait[h] = _load(model_dir / wait_file(h))
    except xgb.core.XGBoostError as e:
        logger.exception("모델 로드 실패")
        return ModelStore(error=f"모델 로드 실패: {e}")

    version_path = model_dir / VERSION_FILE
    store.version = version_path.read_text().strip() if version_path.exists() else "unknown"
    logger.info("모델 6개 로드 완료 - 버전 %s", store.version)
    return store
