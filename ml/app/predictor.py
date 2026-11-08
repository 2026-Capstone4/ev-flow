"""모델 6개 실행 → 응답 형식으로 정리 (docs/prediction.md)"""
import numpy as np
import xgboost as xgb

from app.features import Features
from app.model_store import HORIZONS, ModelStore
from app.schemas import HorizonPrediction

# 🟡 혼잡도 클래스 번호 → 라벨. AI 팀 학습 라벨과 맞춰야 함
CONGESTION_LABELS = ("low", "medium", "high")


def to_labels(raw: np.ndarray) -> list[str]:
    """multi:softprob는 (n, 3) 확률, multi:softmax는 (n,) 클래스 번호로 나옴 - 둘 다 받음"""
    classes = raw.argmax(axis=1) if raw.ndim == 2 else raw.astype(int)
    return [CONGESTION_LABELS[c] for c in classes]


def to_wait_range(raw: np.ndarray) -> np.ndarray:
    """(n, 2) = [P50, P90]. 분위수 교차(P50 > P90)는 정렬로 보정하고 음수는 0으로 맞춤"""
    if raw.ndim != 2 or raw.shape[1] != 2:
        raise ValueError(f"대기시간 모델 출력이 (n, 2)가 아님: {raw.shape}")
    return np.clip(np.sort(raw, axis=1), 0, None)


def predict(store: ModelStore, features: Features) -> dict[str, list[HorizonPrediction]]:
    dmatrix = xgb.DMatrix(features.matrix, feature_names=features.names)
    result: dict[str, list[HorizonPrediction]] = {sid: [] for sid in features.station_ids}
    for h in HORIZONS:  # 15 · 30 · 60 순서 그대로 쌓임
        labels = to_labels(store.congestion[h].predict(dmatrix))
        waits = to_wait_range(store.wait[h].predict(dmatrix))
        for sid, label, (p50, p90) in zip(features.station_ids, labels, waits):
            result[sid].append(HorizonPrediction(
                horizon=h, congestion=label, wait_p50=round(float(p50), 1), wait_p90=round(float(p90), 1),
            ))
    return result
