import json
import os
from copy import deepcopy
from datetime import UTC, datetime
from types import SimpleNamespace

import httpx
import pytest

# app.config가 import 시점에 필수 설정을 읽음 - .env가 없는 환경(CI)에서도 돌도록 가짜 값을 넣음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test")
os.environ.setdefault("EV_SERVICE_KEY", "test")

from app.collector import prediction  # noqa: E402
from app.collector.prediction import build_value, convert_row  # noqa: E402

BASE = datetime(2026, 11, 8, 5, 5, tzinfo=UTC)
NOW = datetime(2026, 11, 8, 5, 5, 40, tzinfo=UTC)
RUN = SimpleNamespace(started_at=BASE, id=7)
DEPLOYMENT = {
    "deployment_id": "evflow_station_recommendation_1530_20261116",
    "model_version": "station_wait_time_v1_20261115",
}
VERSIONS = {"congestion": "xgb_v1_20261108", "time": "station_wait_time_v1_20261115"}


def row(station_id="A", horizon=15, level="여유", p50=0.0, p90=3.5, time_status="ok", **congestion):
    """AI 패키지 응답 predictions[]의 한 행 (필요한 필드만)"""
    return {
        "station_id": station_id,
        "horizon_minutes": horizon,
        "model_versions": VERSIONS,
        "components": {
            "congestion": {
                "status": "ok",
                "congestion_level": level,
                "occupancy": 0.25,
                "congestion_prob": 0.1,
                **congestion,
            },
            "time": {"status": time_status, "p50_minutes": p50, "p90_minutes": p90},
        },
    }


def station(station_id="A"):
    return [row(station_id, 15), row(station_id, 30, "보통", 2.0, 8.0)]


def body(*rows):
    return {"status": "partial", "deployment": DEPLOYMENT, "predictions": list(rows)}


CELLS = [
    {
        "horizon": 15,
        "congestion": "low",
        "wait_p50": 0.0,
        "wait_p90": 3.5,
        "occupancy": 0.25,
        "congestion_prob": 0.1,
    },
    {
        "horizon": 30,
        "congestion": "medium",
        "wait_p50": 2.0,
        "wait_p90": 8.0,
        "occupancy": 0.25,
        "congestion_prob": 0.1,
    },
]


# --- 한 행 변환 (docs/prediction.md collector 검증) ---


def test_convert_row_maps_level_and_keeps_scores():
    assert convert_row(row()) == CELLS[0]
    assert convert_row(row(level="congested"))["congestion"] == "high"


@pytest.mark.parametrize(
    "kwargs",
    [
        {"time_status": "unavailable"},
        {"p50": 9.0},  # P50 > P90
        {"p50": -1.0},
        {"p90": float("nan")},
        {"p50": True},
        {"p50": "2"},
        {"p90": None},
    ],
)
def test_convert_row_drops_only_wait(kwargs):
    cell = convert_row(row(**kwargs))
    assert cell["congestion"] == "low"
    assert cell["wait_p50"] is None and cell["wait_p90"] is None


@pytest.mark.parametrize(
    "broken",
    [
        {"status": "unavailable"},
        {"congestion_level": None},
        {"congestion_level": "unknown"},
    ],
)
def test_convert_row_rejects_without_congestion(broken):
    r = row()
    r["components"]["congestion"].update(broken)
    assert convert_row(r) is None


def test_convert_row_rejects_wrong_shape():
    assert convert_row("x") is None
    assert convert_row({"components": None}) is None


def test_convert_row_drops_out_of_range_scores():
    cell = convert_row(row(occupancy=1.5, congestion_prob=float("nan")))
    assert cell["occupancy"] is None and cell["congestion_prob"] is None


# --- 응답 전체 → pred:v2 값 ---


def test_build_value_keeps_complete_target_stations_only():
    half = [station("B")[0]]  # 30분 없음
    broken = station("C")
    broken[1]["components"]["congestion"]["status"] = "unavailable"
    dup = [row("D", 15), row("D", 15)]  # 15분이 두 번
    value, dropped = build_value(
        body(*station("A"), *half, *broken, *dup, *station("Z")),  # Z는 수집 대상 아님
        {"A", "B", "C", "D"},
        BASE,
        7,
        NOW,
    )
    assert value["stations"] == {"A": CELLS} and dropped == 4
    assert value["base_time"] == "2026-11-08T05:05:00+00:00"
    assert value["collection_run_id"] == 7
    assert value["model_version"] == DEPLOYMENT["deployment_id"]
    assert value["model_versions"] == VERSIONS


def test_build_value_sorts_by_horizon():
    value, _ = build_value(body(*reversed(station())), {"A"}, BASE, 7, NOW)
    assert value["stations"]["A"] == CELLS


@pytest.mark.parametrize(
    "response",
    [
        None,
        {"predictions": station()},  # deployment 없음
        {"deployment": {}, "predictions": station()},
        {"deployment": DEPLOYMENT, "predictions": {}},
        body(),  # 남는 충전소 없음
    ],
)
def test_build_value_rejects(response):
    with pytest.raises(ValueError):
        build_value(response, {"A"}, BASE, 7, NOW)


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
    sent = []
    monkeypatch.setattr(prediction, "_redis", fake)
    monkeypatch.setattr(prediction, "load_targets", lambda db: {"A"})

    def post(url, json, timeout):
        sent.append((url, json))
        if error:
            raise error
        status, kwargs = response
        return httpx.Response(status, request=httpx.Request("POST", url), **kwargs)

    monkeypatch.setattr(prediction.httpx, "post", post)
    monkeypatch.setattr(prediction.settings, "ml_url", "http://ml:8001")
    return fake, sent


def test_refresh_sends_run_id_and_saves_with_ttl(monkeypatch):
    fake, sent = setup(monkeypatch, response=(200, {"json": body(*station())}))
    prediction.refresh_predictions(None, RUN)
    assert sent == [("http://ml:8001/internal/v1/predict", {"run_id": 7})]
    key, value, ex = fake.calls[0]
    assert key == "pred:v2" and ex == 1200 and value["stations"] == {"A": CELLS}


@pytest.mark.parametrize(
    "kwargs",
    [
        {"response": (503, {"json": {"status": "failed", "reason": "database_unavailable"}})},
        {"response": (409, {"json": {"reason": "invalid_frozen_run_evidence"}})},
        {"response": (500, {"text": "error"})},
        {"response": (200, {"json": body()})},
        {"error": httpx.ConnectError("ml down")},
    ],
)
def test_refresh_keeps_existing_on_failure(monkeypatch, kwargs):
    fake, _ = setup(monkeypatch, **kwargs)
    prediction.refresh_predictions(None, RUN)  # 예외가 나면 테스트 실패
    assert fake.calls == []


def test_refresh_swallows_redis_error(monkeypatch):
    setup(monkeypatch, response=(200, {"json": body(*station())}), redis_fail=True)
    prediction.refresh_predictions(None, RUN)


def test_build_value_does_not_change_response():
    response = body(*station())
    before = deepcopy(response)
    build_value(response, {"A"}, BASE, 7, NOW)
    assert response == before
