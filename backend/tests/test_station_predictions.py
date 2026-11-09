import json
import os
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
import redis

# app.config가 import 시점에 필수 설정을 읽음 - .env가 없는 환경(CI)에서도 돌도록 가짜 값을 넣음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test")
os.environ.setdefault("EV_SERVICE_KEY", "test")

from app.services import predictions  # noqa: E402
from app.services.predictions import build_predictions, load_baseline, load_model_predictions  # noqa: E402

# 월 00:40 KST - 기준선 대상 시각은 +15분 00:55(0번 칸), +30분 01:10 · +60분 01:40(1번 칸)
NOW = datetime(2026, 11, 8, 15, 40, tzinfo=timezone.utc)
BASELINE = {"A": ["low", "high"] + [None] * 166}
MODEL = {"A": [
    {"horizon": 15, "congestion": "low", "wait_p50": 0.0, "wait_p90": 2.5},
    {"horizon": 30, "congestion": "medium", "wait_p50": 1.49, "wait_p90": 4.5},
    {"horizon": 60, "congestion": "high", "wait_p50": 3.0, "wait_p90": 10.0},
]}
FROM_BASELINE = [(15, "low", None, None, "baseline"), (30, "high", None, None, "baseline"),
                 (60, "high", None, None, "baseline")]
ALL_NULL = [(h, None, None, None, None) for h in (15, 30, 60)]


def run(quality="normal", model=MODEL, baseline=BASELINE):
    return [(p.horizon_minutes, p.congestion, p.wait_time_p50_minutes, p.wait_time_p90_minutes, p.source)
            for p in build_predictions("A", quality, model, baseline, NOW)]


# --- 조회 규칙 (docs/prediction.md api 조회 규칙) ---

def test_model_used_and_wait_rounded_half_up():
    assert run() == [(15, "low", 0, 3, "model"), (30, "medium", 1, 5, "model"), (60, "high", 3, 10, "model")]


@pytest.mark.parametrize("quality", ["normal", "missing", "delayed"])
def test_model_used_unless_quality_baseline(quality):
    assert run(quality)[0][4] == "model"


def test_quality_baseline_ignores_model():
    assert run("baseline") == FROM_BASELINE


@pytest.mark.parametrize("model", [None, {}, {"B": MODEL["A"]}])
def test_falls_back_to_baseline_without_model(model):
    assert run(model=model) == FROM_BASELINE


@pytest.mark.parametrize("baseline", [None, {}, {"A": [None] * 168}])
def test_all_null_without_baseline(baseline):
    assert run(model=None, baseline=baseline) == ALL_NULL


# --- Redis 읽기 · 기준선 캐시 ---

class FakeRedis:
    def __init__(self):
        self.value, self.fail, self.calls = None, False, 0

    def get(self, key):
        self.calls += 1
        if self.fail:
            raise redis.ConnectionError("down")
        return self.value


@pytest.fixture
def fake(monkeypatch):
    f = FakeRedis()
    clock = SimpleNamespace(now=1000.0)
    monkeypatch.setattr(predictions, "_redis", f)
    monkeypatch.setattr(predictions, "_baseline_cache", None)
    monkeypatch.setattr(predictions, "time", SimpleNamespace(monotonic=lambda: clock.now))
    f.clock = clock
    return f


def stored(stations):
    return json.dumps({"stations": stations})


def test_model_predictions_read(fake):
    assert load_model_predictions() is None  # 키 없음
    fake.value = stored(MODEL)
    assert load_model_predictions() == MODEL
    fake.fail = True
    assert load_model_predictions() is None


def test_baseline_cached_for_ten_minutes(fake):
    fake.value = stored(BASELINE)
    assert load_baseline() == BASELINE
    fake.value = stored({})
    fake.clock.now += 599
    assert load_baseline() == BASELINE and fake.calls == 1
    fake.clock.now += 2
    assert load_baseline() == {} and fake.calls == 2


def test_missing_baseline_not_cached(fake):
    assert load_baseline() is None
    fake.value = stored(BASELINE)
    assert load_baseline() == BASELINE  # collector가 다시 만들면 바로 씀


def test_redis_error_keeps_last_baseline(fake):
    fake.fail = True
    assert load_baseline() is None  # 캐시도 없으면 null
    fake.fail = False
    fake.value = stored(BASELINE)
    load_baseline()
    fake.clock.now += 601
    fake.fail = True
    assert load_baseline() == BASELINE
