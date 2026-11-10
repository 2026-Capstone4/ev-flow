import os
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

# app.config가 import 시점에 필수 설정을 읽음 - .env가 없는 환경(CI)에서도 돌도록 가짜 값을 넣음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test")
os.environ.setdefault("EV_SERVICE_KEY", "test")

from app.collector.baseline import MIN_SAMPLES, SLOTS, build_slots  # noqa: E402
from app.services.predictions import baseline_slot  # noqa: E402

MON_00 = datetime(2026, 11, 8, 15, 0, tzinfo=UTC)  # 2026-11-09(월) 00:00 KST → 0번 칸
TOTALS = {"A": 4}
# 4기 기준 (current_congestion 규칙): low = 사용 가능 3 · 충전 1 / medium = 1 · 3 / high = 0 · 4
LOW, MEDIUM, HIGH = (3, 1), (1, 3), (0, 4)


def row(level, n, confirmed=4, station="A", hour=MON_00):
    available, charging = level
    return SimpleNamespace(
        station_id=station,
        hour=hour,
        confirmed=confirmed,
        available=available,
        charging=charging,
        n=n,
    )


def test_slot_is_kst_weekday_and_hour():
    assert baseline_slot(MON_00) == 0
    assert baseline_slot(datetime(2026, 11, 15, 14, 0, tzinfo=UTC)) == SLOTS - 1  # 일 23시 KST


def test_most_frequent_level_wins():
    slots = build_slots([row(LOW, 10), row(MEDIUM, 5)], TOTALS)["A"]
    assert slots[0] == "low"
    assert slots[1:] == [None] * (SLOTS - 1)


def test_tie_goes_to_more_congested():
    assert build_slots([row(LOW, 6), row(HIGH, 6)], TOTALS)["A"][0] == "high"


def test_same_slot_merges_across_weeks():
    rows = [
        row(MEDIUM, MIN_SAMPLES // 2),
        row(MEDIUM, MIN_SAMPLES // 2, hour=MON_00 + timedelta(days=7)),
    ]
    assert build_slots(rows, TOTALS)["A"][0] == "medium"


def test_too_few_samples_left_empty():
    rows = [row(LOW, MIN_SAMPLES - 1), row(LOW, MIN_SAMPLES, hour=MON_00 + timedelta(hours=1))]
    assert build_slots(rows, TOTALS)["A"][:2] == [None, "low"]


def test_unknown_and_unavailable_are_not_samples():
    rows = [
        row(LOW, MIN_SAMPLES - 1),
        row(LOW, 20, confirmed=3),  # 확인 비율 75% → unknown
        row((0, 0), 20),  # 모두 운영중지 · 점검중 → unavailable
    ]
    # 남은 표본이 기준 미만이라 값이 하나도 없음 → 충전소째 빠짐
    assert build_slots(rows, TOTALS) == {}


def test_station_not_in_targets_is_skipped():
    assert build_slots([row(LOW, MIN_SAMPLES, station="Z")], TOTALS) == {}
