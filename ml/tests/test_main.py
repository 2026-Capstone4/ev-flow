from fastapi.testclient import TestClient

from app import main
from app.model_store import load_models
from tests.test_predictor import write_models

BODY = {"base_time": "2026-11-08T05:05:00+00:00", "rows": []}


def client_with(model_dir, monkeypatch):
    monkeypatch.setattr(main, "load_models", lambda: load_models(model_dir))
    return TestClient(main.app)


def test_no_models_health_ok_and_predict_503(tmp_path, monkeypatch):
    with client_with(tmp_path, monkeypatch) as client:
        health = client.get("/health").json()
        assert health["status"] == "ok" and health["models_ready"] is False
        assert client.post("/predict", json=BODY).status_code == 503


def test_models_without_feature_code_predict_503(tmp_path, monkeypatch):
    write_models(tmp_path)
    with client_with(tmp_path, monkeypatch) as client:
        assert client.get("/health").json()["model_version"] == "20261110"
        res = client.post("/predict", json=BODY)
        assert res.status_code == 503
        assert "AI-03" in res.json()["detail"]
