import os
from datetime import UTC, date, datetime, timedelta

# app.config가 import 시점에 필수 설정을 읽음 - .env가 없는 환경(CI)에서도 돌도록 가짜 값을 넣음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test")
os.environ.setdefault("EV_SERVICE_KEY", "test")

import pytest  # noqa: E402
import redis  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.api.deps import require_admin  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.base import KST  # noqa: E402
from app.services import admin  # noqa: E402

NOW = datetime(2026, 11, 16, 14, 5, tzinfo=KST)  # 월요일
TODAY = date(2026, 11, 16)


class FakeRedis:
    def __init__(self):
        self.values, self.ttls = {}, {}

    def mget(self, keys):
        return [self.values.get(k) for k in keys]

    def pipeline(self):
        return self

    def set(self, key, value, ex=None):
        self.values[key] = value.encode()
        self.ttls[key] = ex

    def execute(self):
        pass


class BrokenRedis:
    def mget(self, keys):
        raise redis.ConnectionError("down")

    def pipeline(self):
        raise redis.ConnectionError("down")


@pytest.fixture(autouse=True)
def fake_redis(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(admin, "_redis", fake)
    return fake


@pytest.fixture
def db_calls(monkeypatch):
    """log_counts 대역 - date 집계는 날짜마다 (충전 중, 분모) = (그날 일, 10). 호출 구간을 남김"""
    calls = []

    def fake_log_counts(db, target, start, end, group):
        calls.append((start.date(), end.date()))
        days = (end - start).days
        return {
            start.date() + timedelta(days=i): ((start + timedelta(days=i)).day, 10)
            for i in range(days)
        }

    monkeypatch.setattr(admin, "log_counts", fake_log_counts)
    return calls


# --- 날짜 경계 · 비율 ---


def test_kst_day_boundary():
    assert admin.kst_today(datetime(2026, 11, 15, 15, 0, tzinfo=UTC)) == TODAY  # UTC 15시 = KST 0시
    assert admin.day_start(TODAY).isoformat() == "2026-11-16T00:00:00+09:00"


def test_ratio_is_null_without_observation():
    assert admin.ratio(0, 0) is None
    assert admin.ratio(1, 3) == 0.3333


# --- 일별 캐시 ---


def test_closed_days_cached_and_today_recomputed(fake_redis, db_calls):
    days = [date(2026, 11, 14), date(2026, 11, 15), TODAY]
    first = admin.daily_log_counts(None, "city", days, NOW)
    assert first == {days[0]: (14, 10), days[1]: (15, 10), TODAY: (16, 10)}
    assert set(fake_redis.values) == {
        "admin:occ:v1:city:2026-11-14",
        "admin:occ:v1:city:2026-11-15",
    }
    assert set(fake_redis.ttls.values()) == {admin.DAY_CACHE_TTL_SEC}

    assert admin.daily_log_counts(None, "city", days, NOW) == first
    assert db_calls == [(date(2026, 11, 14), date(2026, 11, 17)), (TODAY, date(2026, 11, 17))]


def test_yesterday_cached_ten_minutes_after_midnight(fake_redis, db_calls):
    days = [date(2026, 11, 15), TODAY]
    admin.daily_log_counts(None, "city", days, datetime(2026, 11, 16, 0, 9, tzinfo=KST))
    assert fake_redis.values == {}  # 자정을 넘겨 커밋되는 회차가 있을 수 있음
    admin.daily_log_counts(None, "city", days, datetime(2026, 11, 16, 0, 10, tzinfo=KST))
    assert set(fake_redis.values) == {"admin:occ:v1:city:2026-11-15"}


def test_redis_down_falls_back_to_db(monkeypatch, db_calls):
    monkeypatch.setattr(admin, "_redis", BrokenRedis())
    assert admin.daily_log_counts(None, "city", [TODAY], NOW) == {TODAY: (16, 10)}


# --- 이용률 ---


def test_week_groups_by_weekday_and_pools_average(monkeypatch):
    seen = []

    def fake_daily(db, target, days, now):
        seen.append((target, days[0], days[-1], len(days)))
        return {d: (1, 4) for d in days}

    monkeypatch.setattr(admin, "daily_log_counts", fake_daily)
    res = admin.get_utilization(None, "all", "week", NOW)
    assert seen == [
        ("city", date(2026, 10, 20), TODAY, 28),
        ("service_area", date(2026, 10, 20), TODAY, 28),
    ]
    assert res.from_.isoformat() == "2026-10-20T00:00:00+09:00"
    assert [b.label for b in res.series] == ["월", "화", "수", "목", "금", "토", "일"]
    # 요일마다 4일 × 대상 2곳 × 분모 4
    assert all(b.observation_count == 32 and b.occupancy_rate == 0.25 for b in res.series)
    assert res.average_occupancy_rate == 0.25


def test_day_has_24_hours_and_empty_hours_are_null(monkeypatch):
    monkeypatch.setattr(admin, "log_counts", lambda db, t, s, e, g: {0: (1, 2), 14: (0, 5)})
    res = admin.get_utilization(None, "city", "day", NOW)
    assert len(res.series) == 24 and res.series[14].label == "14시"
    assert res.series[0].occupancy_rate == 0.5
    assert res.series[15].occupancy_rate is None and res.series[15].observation_count == 0
    assert res.average_occupancy_rate == round(1 / 7, 4)  # 칸별 평균(0.25)이 아니라 관측 합계 비율


# --- 엔드포인트 ---


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = lambda: None
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.mark.parametrize("path", ["utilization", "chargers", "collection-status", "missing-stats"])
def test_dashboard_requires_login(client, path):
    res = client.get(f"/api/v1/admin/{path}")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHORIZED"


def test_dashboard_response_uses_camel_case_and_from(client, monkeypatch):
    app.dependency_overrides[require_admin] = lambda: None
    monkeypatch.setattr(admin, "log_counts", lambda db, t, s, e, g: {})
    body = client.get("/api/v1/admin/utilization?region=city").json()
    assert body["from"].endswith("T00:00:00+09:00")  # 오늘 KST 0시
    assert set(body) == {"region", "period", "from", "to", "averageOccupancyRate", "series"}
    assert body["averageOccupancyRate"] is None
    assert body["series"][0] == {
        "bucket": 0,
        "label": "0시",
        "occupancyRate": None,
        "observationCount": 0,
    }


def test_unknown_region_is_422(client):
    app.dependency_overrides[require_admin] = lambda: None
    res = client.get("/api/v1/admin/utilization?region=seoul")
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"
