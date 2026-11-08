import numpy as np
import pytest
import xgboost as xgb

from app.features import Features
from app.model_store import HORIZONS, congestion_file, load_models, wait_file
from app.predictor import predict, to_labels, to_wait_range

FEATURE_NAMES = ["hour", "weekday", "occupancy"]


def test_to_labels_softprob():
    raw = np.array([[0.7, 0.2, 0.1], [0.1, 0.1, 0.8]])
    assert to_labels(raw) == ["low", "high"]


def test_to_labels_softmax():
    assert to_labels(np.array([1.0, 0.0])) == ["medium", "low"]


def test_to_wait_range_sorts_crossed_quantiles_and_clips_negative():
    raw = np.array([[12.0, 5.0], [-1.0, 3.0]])
    assert to_wait_range(raw).tolist() == [[5.0, 12.0], [0.0, 3.0]]


def test_to_wait_range_rejects_single_quantile():
    with pytest.raises(ValueError):
        to_wait_range(np.array([1.0, 2.0]))


def write_models(model_dir, version="20261110"):
    """학습 형식과 같은 작은 모델 6개 - 분류 multi:softprob 3클래스 · 회귀 분위수 [0.5, 0.9]"""
    rng = np.random.default_rng(0)
    x = rng.random((60, len(FEATURE_NAMES)))
    dtrain_cls = xgb.DMatrix(x, label=rng.integers(0, 3, 60), feature_names=FEATURE_NAMES)
    dtrain_reg = xgb.DMatrix(x, label=rng.random(60) * 20, feature_names=FEATURE_NAMES)
    for h in HORIZONS:
        xgb.train({"objective": "multi:softprob", "num_class": 3}, dtrain_cls, 3).save_model(
            model_dir / congestion_file(h))
        xgb.train({"objective": "reg:quantileerror", "quantile_alpha": [0.5, 0.9]}, dtrain_reg, 3).save_model(
            model_dir / wait_file(h))
    (model_dir / "VERSION").write_text(version + "\n")


def test_load_models_missing_file(tmp_path):
    store = load_models(tmp_path)
    assert not store.ready
    assert "congestion_h15.ubj" in store.error


def test_load_models_and_predict(tmp_path):
    write_models(tmp_path)
    store = load_models(tmp_path)
    assert store.ready and store.version == "20261110"

    features = Features(station_ids=["A", "B"], matrix=np.random.default_rng(1).random((2, 3)), names=FEATURE_NAMES)
    result = predict(store, features)
    assert set(result) == {"A", "B"}
    for preds in result.values():
        assert [p.horizon for p in preds] == [15, 30, 60]
        assert all(0 <= p.wait_p50 <= p.wait_p90 for p in preds)


def test_predict_rejects_wrong_feature_names(tmp_path):
    write_models(tmp_path)
    store = load_models(tmp_path)
    features = Features(station_ids=["A"], matrix=np.zeros((1, 3)), names=["weekday", "hour", "occupancy"])
    with pytest.raises(ValueError):
        predict(store, features)
