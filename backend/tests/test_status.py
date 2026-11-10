from datetime import UTC, datetime, timedelta

import pytest

from app.services.status import (
    current_congestion,
    elapsed_quality,
    station_quality,
    to_capacity_kw,
    to_charger_status,
)

NOW = datetime(2026, 10, 30, 5, 5, tzinfo=UTC)


def minutes_ago(minutes: int) -> datetime:
    return NOW - timedelta(minutes=minutes)


@pytest.mark.parametrize(
    ("stat", "expected"),
    [
        ("2", "available"),
        ("3", "charging"),
        ("6", "charging"),
        ("4", "stopped"),
        ("5", "maintenance"),
        ("0", "unknown"),
        ("1", "unknown"),
        ("9", "unknown"),
        (None, "unknown"),
    ],
)
def test_to_charger_status(stat, expected):
    assert to_charger_status(stat, stale=False) == expected


def test_stale_charger_is_unknown():
    assert to_charger_status("2", stale=True) == "unknown"


def test_to_capacity_kw():
    assert to_capacity_kw("100") == 100
    assert isinstance(to_capacity_kw("100"), int)
    assert to_capacity_kw("7.5") == 7.5


@pytest.mark.parametrize(
    ("minutes", "expected"),
    [(0, "normal"), (9, "normal"), (10, "delayed"), (19, "delayed"), (20, "baseline")],
)
def test_elapsed_quality(minutes, expected):
    assert elapsed_quality(minutes_ago(minutes), NOW) == expected


@pytest.mark.parametrize(
    ("statuses", "minutes", "expected"),
    [
        (["available"] * 5, 0, "normal"),
        (["available"] * 4 + ["unknown"], 0, "missing"),  # 확인 비율 80%
        (["available"] * 3 + ["unknown"] * 2, 0, "baseline"),  # 확인 비율 60%
        (["available"] * 4 + ["unknown"], 10, "delayed"),  # delayed가 missing보다 우선
        (["available"] * 5, 20, "baseline"),
    ],
)
def test_station_quality(statuses, minutes, expected):
    assert station_quality(statuses, minutes_ago(minutes), NOW) == expected


@pytest.mark.parametrize(
    ("statuses", "expected"),
    [
        (["available", "available", "charging"], "low"),  # 점유율 33% · 가용 2
        (["available", "available", "charging", "charging"], "medium"),  # 점유율 50%
        (["available", "charging"], "medium"),  # 가용 1
        (["available"], "medium"),  # 1기 충전소는 비어 있어도 여유가 아님
        (
            ["available", "available", "maintenance", "maintenance"],
            "low",
        ),  # 점검은 점유율 분모에서 뺌
        (["charging", "charging", "maintenance"], "high"),
        (["maintenance", "stopped"], "unavailable"),
        (["maintenance"] * 4 + ["unknown"], "unavailable"),  # 확인 비율 80% - 확인된 충전기 기준
        (["maintenance"] * 3 + ["unknown"] * 2, "unknown"),  # 확인 불가가 운영 불가보다 우선
        (["available"] * 3 + ["unknown"] * 2, "unknown"),
    ],
)
def test_current_congestion(statuses, expected):
    assert current_congestion(statuses) == expected
