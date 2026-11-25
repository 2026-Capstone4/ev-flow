import os
from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace

# app.config가 import 시점에 필수 설정을 읽음 - .env가 없는 환경(CI)에서도 돌도록 가짜 값을 넣음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test")
os.environ.setdefault("EV_SERVICE_KEY", "test")

import pytest  # noqa: E402
import redis  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.api.deps import require_admin  # noqa: E402
from app.api.errors import ApiError  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.base import KST  # noqa: E402
from app.services import admin  # noqa: E402
from app.services.snapshot import ChargerState  # noqa: E402

NOW = datetime(2026, 11, 16, 14, 5, tzinfo=KST)  # 월요일
TODAY = date(2026, 11, 16)


class FakeRedis:
    """문자열 값(values) · 해시(hashes) · 만료(ttls). 파이프라인은 모았다가 execute에서 실행"""

    def __init__(self):
        self.values, self.hashes, self.ttls = {}, {}, {}

    def mget(self, keys):
        return [self.values.get(k) for k in keys]

    def pipeline(self):
        return FakePipeline(self)

    def set(self, key, value, ex=None):
        self.values[key] = value.encode()
        self.ttls[key] = ex

    def hget(self, key, field):
        return self.hashes.get(key, {}).get(field.encode())

    def hgetall(self, key):
        return dict(self.hashes.get(key, {}))

    def hset(self, key, mapping):
        self.hashes.setdefault(key, {}).update({k.encode(): v.encode() for k, v in mapping.items()})

    def expire(self, key, seconds):
        self.ttls[key] = seconds


class FakePipeline:
    def __init__(self, fake):
        self.fake, self.calls = fake, []

    def __getattr__(self, name):
        return lambda *args, **kwargs: self.calls.append((name, args, kwargs))

    def execute(self):
        return [getattr(self.fake, n)(*a, **kw) for n, a, kw in self.calls]


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


def fake_hour_charger(start, end):
    """hour_charger 대역 값 - 시간대마다 충전기 S1|01 = (1, 10), S1|02 = (0, 10)"""
    counts, t = {}, start
    while t < end:
        hour = t.astimezone(KST).hour
        counts[(hour, "S1", "01")] = (1, 10)
        counts[(hour, "S1", "02")] = (0, 10)
        t += timedelta(hours=1)
    return counts


@pytest.fixture(autouse=True)
def districts(monkeypatch):
    """충전소 → 구 대역 - S1은 마포구(city) · 강남구(live), S2는 송파구(live)"""
    table = {"city": {"S1": "11440"}, "live": {"S1": "11680", "S2": "11710"}}
    monkeypatch.setattr(admin, "station_districts", lambda db, target: table.get(target, {}))
    return table


@pytest.fixture
def db_calls(monkeypatch):
    """log_counts 대역 - date 집계는 날짜마다 (충전 중, 분모) = (그날 일, 10), date_station은
    같은 값을 충전소 S1로, hour_charger는 fake_hour_charger. 호출 (group, 시작, 끝)을 남김"""
    calls = []

    def fake_log_counts(db, target, start, end, group):
        calls.append((group, start, end))
        if group == "hour_charger":
            return fake_hour_charger(start, end)
        days = (end - start).days
        counts = {
            start.date() + timedelta(days=i): ((start + timedelta(days=i)).day, 10)
            for i in range(days)
        }
        if group == "date_station":
            return {(day, "S1"): value for day, value in counts.items()}
        return counts

    monkeypatch.setattr(admin, "log_counts", fake_log_counts)
    return calls


def kst(day, hour, minute=0):
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=KST)


# --- 날짜 경계 · 비율 ---


def test_kst_day_boundary():
    assert admin.kst_today(datetime(2026, 11, 15, 15, 0, tzinfo=UTC)) == TODAY  # UTC 15시 = KST 0시
    assert admin.day_start(TODAY).isoformat() == "2026-11-16T00:00:00+09:00"


def test_ratio_is_null_without_observation():
    assert admin.ratio(0, 0) is None
    assert admin.ratio(1, 3) == 0.3333


# --- 일별 캐시 ---


def test_closed_days_cached_and_today_from_hours(fake_redis, db_calls):
    days = [date(2026, 11, 14), date(2026, 11, 15), TODAY]
    first = admin.daily_log_counts(None, "city", days, NOW)
    # 오늘은 0~14시 15칸 × 충전기 2대 (1 + 0, 10 + 10)
    assert first == {days[0]: (14, 10), days[1]: (15, 10), TODAY: (15, 300)}
    assert set(fake_redis.values) == {
        "admin:occ:v1:city:2026-11-14",
        "admin:occ:v1:city:2026-11-15",
    }

    assert admin.daily_log_counts(None, "city", days, NOW) == first
    assert [c[0] for c in db_calls] == ["hour_charger", "date", "hour_charger"]
    assert db_calls[1][1:] == (kst(date(2026, 11, 14), 0), kst(TODAY, 0))  # 끝난 날만 date 집계
    assert db_calls[2][1:] == (kst(TODAY, 13), NOW)  # 두 번째는 저장 안 된 13 · 14시만


def test_yesterday_cached_ten_minutes_after_midnight(fake_redis, db_calls):
    days = [date(2026, 11, 15), TODAY]
    admin.daily_log_counts(None, "city", days, kst(TODAY, 0, 9))
    assert fake_redis.values == {}  # 자정을 넘겨 커밋되는 회차가 있을 수 있음
    admin.daily_log_counts(None, "city", days, kst(TODAY, 0, 10))
    assert set(fake_redis.values) == {"admin:occ:v1:city:2026-11-15"}


def test_redis_down_falls_back_to_db(monkeypatch, db_calls):
    monkeypatch.setattr(admin, "_redis", BrokenRedis())
    assert admin.daily_log_counts(None, "city", [TODAY], NOW) == {TODAY: (15, 300)}
    assert admin.daily_log_counts(None, "city", [date(2026, 11, 15)], NOW) == {
        date(2026, 11, 15): (15, 10)
    }


# --- 시간대별 캐시 ---


def test_closed_hours_cached_and_current_hour_recomputed(fake_redis, db_calls):
    first = admin.hourly_log_counts(None, "service_area", TODAY, NOW)
    assert sorted(first) == list(range(15))  # 0 ~ 14시
    assert first[3][admin.HOUR_TOTAL_FIELD] == (1, 20)
    # 13시는 14:10이 지나야 끝난 것으로 봄
    assert set(fake_redis.hashes) == {
        f"admin:occ-hour:v1:service_area:2026-11-16:{h:02d}" for h in range(13)
    }
    assert set(fake_redis.ttls.values()) == {admin.HOUR_CACHE_TTL_SEC}
    assert fake_redis.hashes["admin:occ-hour:v1:service_area:2026-11-16:03"] == {
        b"S1|01": b"1,10",
        b"S1|02": b"0,10",
        b"_": b"1,20",
    }

    second = admin.hourly_log_counts(None, "service_area", TODAY, NOW)
    assert {h: f[admin.HOUR_TOTAL_FIELD] for h, f in second.items()} == {
        h: f[admin.HOUR_TOTAL_FIELD] for h, f in first.items()
    }
    assert [c[1:] for c in db_calls] == [(kst(TODAY, 0), NOW), (kst(TODAY, 13), NOW)]


def test_cached_hours_by_charger(fake_redis, db_calls):
    admin.hourly_log_counts(None, "city", TODAY, NOW)
    by_charger = admin.hourly_log_counts(None, "city", TODAY, NOW, by_charger=True)
    assert by_charger[0] == {"S1|01": (1, 10), "S1|02": (0, 10), "_": (1, 20)}  # Redis에서 읽음
    assert by_charger[14] == {"S1|01": (1, 10), "S1|02": (0, 10), "_": (1, 20)}  # DB에서 셈


def test_empty_hour_is_cached(fake_redis, monkeypatch):
    calls = []
    monkeypatch.setattr(admin, "log_counts", lambda *args: calls.append(args) or {})
    first = admin.hourly_log_counts(None, "city", TODAY, NOW)
    assert first[0] == {"_": (0, 0)}  # 수집이 멈춘 시간대 - 다음 요청에 다시 세지 않음
    admin.hourly_log_counts(None, "city", TODAY, NOW)
    assert [c[2] for c in calls] == [kst(TODAY, 0), kst(TODAY, 13)]


def test_hours_redis_down_falls_back_to_db(monkeypatch, db_calls):
    monkeypatch.setattr(admin, "_redis", BrokenRedis())
    counts = admin.hourly_log_counts(None, "city", TODAY, NOW, by_charger=True)
    assert len(counts) == 15 and counts[14]["S1|01"] == (1, 10)


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
        ("live", date(2026, 10, 20), TODAY, 28),
        ("service_area", date(2026, 10, 20), TODAY, 28),
    ]
    assert res.from_.isoformat() == "2026-10-20T00:00:00+09:00"
    assert [b.label for b in res.series] == ["월", "화", "수", "목", "금", "토", "일"]
    # 요일마다 4일 × 대상 3곳 × 분모 4
    assert all(b.observation_count == 48 and b.occupancy_rate == 0.25 for b in res.series)
    assert res.average_occupancy_rate == 0.25


def test_day_has_24_hours_and_empty_hours_are_null(monkeypatch):
    monkeypatch.setattr(
        admin,
        "log_counts",
        lambda db, t, s, e, g: {(0, "S1", "01"): (1, 2), (14, "S1", "01"): (0, 5)},
    )
    res = admin.get_utilization(None, "city", "day", NOW)
    assert len(res.series) == 24 and res.series[14].label == "14시"
    assert res.series[0].occupancy_rate == 0.5
    assert res.series[15].occupancy_rate is None and res.series[15].observation_count == 0
    assert res.average_occupancy_rate == round(1 / 7, 4)  # 칸별 평균(0.25)이 아니라 관측 합계 비율


@pytest.mark.parametrize(
    "region, targets",
    [
        ("all", ["city", "live", "service_area"]),
        ("seoul", ["city", "live"]),  # 마포 + 마포를 뺀 서울 = 서울 전체
        ("city", ["city"]),
        ("service_area", ["service_area"]),
    ],
)
def test_region_targets(region, targets):
    assert admin.targets_of(region) == targets


# --- 미리 계산 ---


def test_warm_cache_fills_closed_days_and_hours_for_every_target(fake_redis, db_calls):
    admin.warm_cache(None, NOW)
    for target in admin.TARGETS:
        assert f"admin:occ:v1:{target}:2026-11-15" in fake_redis.values
        assert f"admin:occ-hour:v1:{target}:2026-11-16:12" in fake_redis.hashes
    # 서울(city · live)은 구별 날짜 집계도 채움
    assert fake_redis.hashes["admin:occ-district:v1:live:2026-11-15"] == {
        b"_": b"15,10",
        b"11680": b"15,10",
    }
    assert "admin:occ-district:v1:service_area:2026-11-15" not in fake_redis.hashes
    # 화면 요청은 끝난 날 · 시간대를 다시 세지 않고 진행 중인 13 · 14시만 DB에서 셈
    db_calls.clear()
    admin.get_utilization(None, "all", "week", NOW)
    assert [c[0] for c in db_calls] == ["hour_charger"] * 3
    assert {c[1:] for c in db_calls} == {(kst(TODAY, 13), NOW)}


def test_warm_cache_continues_after_target_failure(fake_redis, monkeypatch):
    done = []

    def fake_daily(db, target, days, now):
        if target == "city":
            raise RuntimeError("db")
        done.append(target)

    monkeypatch.setattr(admin, "daily_log_counts", fake_daily)
    monkeypatch.setattr(admin, "daily_district_counts", lambda *args: None)
    admin.warm_cache(SimpleNamespace(rollback=lambda: None), NOW)
    assert done == ["live", "service_area"]


# --- 구 ---


@pytest.mark.parametrize(
    "region, district, targets",
    [
        ("seoul", "11680", ["live"]),
        ("seoul", "11440", ["city"]),  # 마포구는 city에만 있음
        ("city", "11440", ["city"]),
    ],
)
def test_district_targets(region, district, targets):
    assert admin.targets_of(region, district) == targets


@pytest.mark.parametrize(
    "region, district",
    [("city", "11680"), ("service_area", "11680"), ("all", "11680")],
)
def test_district_outside_seoul_is_422(region, district):
    with pytest.raises(ApiError) as e:
        admin.targets_of(region, district)
    assert e.value.status_code == 422


def test_by_district_sums_chargers_and_keeps_total():
    fields = {"S1|01": (1, 10), "S1|02": (0, 10), "S2|01": (2, 5), "X|01": (1, 1), "_": (4, 26)}
    assert admin.by_district(fields, {"S1": "11680", "S2": "11710"}) == {
        "_": (4, 26),  # 구를 모르는 충전소(X)도 합계엔 들어감
        "11680": (1, 20),
        "11710": (2, 5),
    }
    assert admin.by_district({}, {}) == {"_": (0, 0)}  # 관측이 없어도 저장 표시가 남음


def test_district_day_uses_cached_hours(fake_redis, db_calls):
    res = admin.get_utilization(None, "seoul", "day", NOW, district="11680")
    assert res.district == "11680"
    assert res.series[3].observation_count == 20 and res.series[3].occupancy_rate == 0.05
    # 다른 구는 관측 없음
    other = admin.get_utilization(None, "seoul", "day", NOW, district="11710")
    assert other.series[3].observation_count == 0 and other.average_occupancy_rate is None
    # 끝난 시간대는 첫 요청 때 저장돼 두 번째 요청은 진행 중인 시간대만 DB에서 셈
    assert [c[1] for c in db_calls] == [kst(TODAY, 0), kst(TODAY, 13)]


def test_district_week_caches_closed_days(fake_redis, db_calls):
    first = admin.get_utilization(None, "seoul", "week", NOW, district="11680")
    groups = [c[0] for c in db_calls]
    assert sorted(groups) == ["date_station", "hour_charger"]  # 끝난 날은 충전소별, 오늘은 시간대별
    assert "admin:occ-district:v1:live:2026-11-15" in fake_redis.hashes
    db_calls.clear()
    second = admin.get_utilization(None, "seoul", "week", NOW, district="11680")
    assert second.series == first.series
    assert [c[0] for c in db_calls] == ["hour_charger"]  # 오늘의 진행 중인 시간대만


def test_chargers_filtered_by_district(monkeypatch, db_calls):
    run = SimpleNamespace(started_at=NOW)
    monkeypatch.setattr(admin, "latest_success_run", lambda db, target: run)
    states = {
        sid: [ChargerState(sid, "01", "available", ["dc_combo"], 100, None)] for sid in ("S1", "S2")
    }
    monkeypatch.setattr(admin, "load_charger_states", lambda *args: states)
    stations = [SimpleNamespace(station_id=sid, name=f"{sid} 충전소") for sid in ("S1", "S2")]
    db = SimpleNamespace(scalars=lambda query: stations)
    res = admin.get_chargers(db, "seoul", NOW, district="11710")
    assert [(c.region, c.station_id, c.district, c.district_name) for c in res.chargers] == [
        ("live", "S2", "11710", "송파구")
    ]
    every = admin.get_chargers(db, "seoul", NOW)
    assert {(c.region, c.station_id, c.district) for c in every.chargers} == {
        ("city", "S1", "11440"),
        ("city", "S2", None),  # 구를 모르는 충전소
        ("live", "S1", "11680"),
        ("live", "S2", "11710"),
    }


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
    assert set(body) == {
        "region",
        "district",
        "period",
        "from",
        "to",
        "averageOccupancyRate",
        "series",
    }
    assert body["district"] is None
    assert body["averageOccupancyRate"] is None
    assert body["series"][0] == {
        "bucket": 0,
        "label": "0시",
        "occupancyRate": None,
        "observationCount": 0,
    }


def test_unknown_district_is_422(client):
    app.dependency_overrides[require_admin] = lambda: None
    res = client.get("/api/v1/admin/chargers?region=seoul&district=26110")  # 부산 중구
    assert res.status_code == 422


def test_unknown_region_is_422(client):
    app.dependency_overrides[require_admin] = lambda: None
    res = client.get("/api/v1/admin/utilization?region=live")  # live는 seoul로만 받음
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"
