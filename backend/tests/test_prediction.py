import json
import os
from datetime import datetime, timezone
from types import SimpleNamespace

import httpx
import pytest

# app.config가 import 시점에 필수 설정을 읽음 - .env가 없는 환경(CI)에서도 돌도록 가짜 값을 넣음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test")
os.environ.setdefault("EV_SERVICE_KEY", "test")

from app.collector import prediction  # noqa: E402
from app.collector.prediction import build_value, valid_predictions  # noqa: E402

BASE = datetime(2026, 11, 8, 5, 5, tzinfo=timezone.utc)
NOW = datetime(2026, 11, 8, 5, 5, 40, tzinfo=timezone.utc)
RUN = SimpleNamespace(started_at=BASE, id=7)
ROWS = [{"station_id": "A", "charger_id": "01", "collected_at": BASE.isoformat(), "stat": "2"}]


def preds(**override):
    rows = [
        {"horizon": 15, "congestion": "low", "wait_p50": 0.0, "wait_p90": 3.5},
        {"horizon": 30, "congestion": "medium", "wait_p50": 2.0, "wait_p90": 8.0},
        {"horizon": 60, "congestion": "high", "wait_p50": 6.5, "wait_p90": 15.0},
    ]
    rows[1].update(override)  # 30분 값만 바꿔 봄
    return rows


# --- 검증 규칙 (docs/prediction.md collector 검증) ---

def test_valid_predictions_sorts_by_horizon_and_drops_extra_fields():
    shuffled = [dict(p, extra=1) for p in reversed(preds())]
    assert valid_predictions(shuffled) == preds()


@pytest.mark.parametrize("override", [
    {"congestion": "unknown"},
    {"horizon": 45},
    {"horizon": 15},  # 15분이 두 번
    {"wait_p50": 9.0},  # P50 > P90
    {"wait_p50": -1.0},
    {"wait_p90": float("nan")},
    {"wait_p90": float("inf")},
    {"wait_p50": True},
    {"wait_p50": "2"},
    {"wait_p90": None},
])
def test_valid_predictions_rejects(override):
    assert valid_predictions(preds(**override)) is None


def test_valid_predictions_rejects_wrong_shape():
    assert valid_predictions(preds()[:2]) is None
    assert valid_predictions("x") is None


def test_build_value_keeps_valid_target_stations_only():
    body = {"model_version": "20261110",
            "stations": {"A": preds(), "B": preds(congestion="bad"), "Z": preds()}}  # Z는 수집 대상 아님
    value, dropped = build_value(body, {"A", "B"}, BASE, 7, NOW)
    assert list(value["stations"]) == ["A"] and dropped == 2
    assert value["base_time"] == "2026-11-08T05:05:00+00:00"
    assert value["collection_run_id"] == 7 and value["model_version"] == "20261110"


@pytest.mark.parametrize("body", [
    None,
    {"stations": {"A": preds()}},  # model_version 없음
    {"model_version": "v", "stations": []},
    {"model_version": "v", "stations": {"A": preds(congestion="bad")}},  # 남는 충전소 없음
])
def test_build_value_rejects(body):
    with pytest.raises(ValueError):
        build_value(body, {"A"}, BASE, 7, NOW)


# --- refresh_predictions: 어떤 실패도 밖으로 내지 않음 ---

class FakeRedis:
    def __init__(self, fail=False):
        self.calls, self.fail = [], fail

    def set(self, key, value, ex):
        if self.fail:
            raise ConnectionError("redis down")
        self.calls.append((key, json.loads(value), ex))


def setup(monkeypatch, response=None, error=None, redis_fail=False):
    fake = FakeRedis(redis_fail)
    monkeypatch.setattr(prediction, "_redis", fake)
    monkeypatch.setattr(prediction, "load_history", lambda db, since: ROWS)

    def post(url, json, timeout):
        if error:
            raise error
        status, kwargs = response
        return httpx.Response(status, request=httpx.Request("POST", url), **kwargs)

    monkeypatch.setattr(prediction.httpx, "post", post)
    return fake


def test_refresh_saves_with_ttl(monkeypatch):
    fake = setup(monkeypatch, response=(200, {"json": {"model_version": "v1", "stations": {"A": preds()}}}))
    prediction.refresh_predictions(None, RUN)
    key, value, ex = fake.calls[0]
    assert key == "pred:v1" and ex == 1200 and list(value["stations"]) == ["A"]


@pytest.mark.parametrize("kwargs", [
    {"response": (503, {"json": {"detail": "모델 파일 없음"}})},
    {"response": (500, {"text": "error"})},
    {"response": (200, {"json": {"model_version": "v1", "stations": {}}})},
    {"error": httpx.ConnectError("ml down")},
])
def test_refresh_keeps_existing_on_failure(monkeypatch, kwargs):
    fake = setup(monkeypatch, **kwargs)
    prediction.refresh_predictions(None, RUN)  # 예외가 나면 테스트 실패
    assert fake.calls == []


def test_refresh_swallows_redis_error(monkeypatch):
    setup(monkeypatch, response=(200, {"json": {"model_version": "v1", "stations": {"A": preds()}}}), redis_fail=True)
    prediction.refresh_predictions(None, RUN)
