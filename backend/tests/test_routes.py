import os

# app.config가 import 시점에 필수 설정을 읽음 - .env가 없는 환경(CI)에서도 돌도록 가짜 값을 넣음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test")
os.environ.setdefault("EV_SERVICE_KEY", "test")

from datetime import datetime  # noqa: E402

import httpx  # noqa: E402
import pytest  # noqa: E402
import redis  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from pydantic import SecretStr  # noqa: E402

from app.config import settings  # noqa: E402
from app.db.models import CityStation, LiveStation  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.base import KST  # noqa: E402
from app.services import directions, rate_limit  # noqa: E402

ORIGIN = {"lat": 37.55631, "lng": 126.92204}
MAPO_ID = "ME19A601"
SEOUL_ID = "KP000013"


class FakePipeline:
    def __init__(self, r):
        self.r = r
        self.ops = []

    def __getattr__(self, name):
        return lambda *args, **kwargs: self.ops.append((name, args, kwargs))

    def execute(self):
        return [getattr(self.r, name)(*args, **kwargs) for name, args, kwargs in self.ops]


class FakeRedis:
    """하루 예산 카운터 · 소진 표시 · 호출 제한에 쓰는 명령만 흉내 냄 - TTL은 줄어들지 않고 설정값 그대로 남음"""

    def __init__(self):
        self.values = {}
        self.ttls = {}

    def pipeline(self):
        return FakePipeline(self)

    def get(self, key):
        return self.values.get(key)

    def set(self, key, value, ex=None):
        self.values[key] = value
        self.ttls[key] = ex
        return True

    def incr(self, key):
        return self.incrby(key, 1)

    def incrby(self, key, n):
        self.values[key] = self.values.get(key, 0) + n
        return self.values[key]

    def decrby(self, key, n):
        return self.incrby(key, -n)

    def expire(self, key, seconds, nx=False):
        if nx and key in self.ttls:
            return False
        self.ttls[key] = seconds
        return True

    def ttl(self, key):
        return self.ttls.get(key, -1) if key in self.values else -2


class BrokenRedis:
    def get(self, key):
        raise redis.ConnectionError("down")

    def set(self, *args, **kwargs):
        raise redis.ConnectionError("down")

    def pipeline(self):
        raise redis.ConnectionError("down")


class FakeClient:
    """Directions 대역 - result가 예외면 던지고, 아니면 그 응답을 돌려줌"""

    def __init__(self):
        self.calls = []
        self.result = ok_response()

    def get(self, url, params=None, headers=None):
        self.calls.append({"url": url, "params": params, "headers": headers})
        return self._answer()

    def post(self, url, json=None, headers=None):
        self.calls.append({"url": url, "json": json, "headers": headers})
        return self._answer()

    def _answer(self):
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


class FakeDB:
    def __init__(self):
        self.rows = {
            (CityStation, MAPO_ID): CityStation(station_id=MAPO_ID, lat=37.5550, lng=126.8978),
            (LiveStation, SEOUL_ID): LiveStation(station_id=SEOUL_ID, lat=37.5400, lng=127.0700),
        }
        self.closed = False

    def get(self, model, key):
        return self.rows.get((model, key))

    def close(self):
        self.closed = True


def ok_response(duration_ms=487_000, distance=2400):
    return httpx.Response(
        200,
        json={
            "code": 0,
            "route": {
                "trafast": [
                    {
                        "summary": {"duration": duration_ms, "distance": distance},
                        "path": [[126.9220, 37.5563], [126.9180, 37.5560], [126.8978, 37.5550]],
                    }
                ]
            },
        },
    )


@pytest.fixture
def fake_redis(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(directions, "_redis", fake)
    monkeypatch.setattr(rate_limit, "_redis", fake)
    return fake


@pytest.fixture
def naver(monkeypatch):
    fake = FakeClient()
    monkeypatch.setattr(directions, "_client", fake)
    monkeypatch.setattr(settings, "directions_provider", "naver")
    monkeypatch.setattr(settings, "naver_client_id", "test-id")
    monkeypatch.setattr(settings, "naver_client_secret", SecretStr("test-secret"))
    return fake


@pytest.fixture
def db():
    fake = FakeDB()
    app.dependency_overrides[get_db] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def client(fake_redis, naver, db):
    return TestClient(app)


def post(client, station_id=MAPO_ID, origin=ORIGIN, ip="1.2.3.4"):
    return client.post(
        "/api/v1/routes",
        json={"origin": origin, "stationId": station_id},
        headers={"X-Real-IP": ip},
    )


def test_returns_route_with_lat_lng_path(client, naver, db):
    res = post(client)
    assert res.status_code == 200
    assert res.json() == {
        "stationId": MAPO_ID,
        "travelTimeMinutes": 8,  # 487초 → 8분
        "distanceMeters": 2400,
        "path": [[37.5563, 126.9220], [37.5560, 126.9180], [37.5550, 126.8978]],
        "provider": "naver",
    }
    # 네이버에는 경도,위도 순서 · 소수 4자리로 반올림한 출발 좌표를 보냄
    params = naver.calls[0]["params"]
    assert params == {"start": "126.92204,37.55631", "goal": "126.8978,37.555", "option": "trafast"}
    assert naver.calls[0]["headers"]["x-ncp-apigw-api-key"] == "test-secret"
    assert db.closed  # Directions 호출 전에 DB 연결을 돌려줌


def test_seoul_station_is_also_a_destination(client):
    res = post(client, station_id=SEOUL_ID)
    assert res.status_code == 200
    assert res.json()["stationId"] == SEOUL_ID


def test_short_route_is_at_least_one_minute(client, naver):
    naver.result = ok_response(duration_ms=20_000, distance=150)
    assert post(client).json()["travelTimeMinutes"] == 1


def test_every_request_calls_provider_without_cache(client, naver, fake_redis):
    # 경로 캐시 없음 (2026-11-22) - 같은 출발지 · 충전소라도 매번 부르고 경로를 저장하지 않음
    post(client)
    assert post(client).status_code == 200
    assert len(naver.calls) == 2
    assert not [k for k in fake_redis.values if k.startswith("route:")]


def test_already_at_station_returns_zero_minutes(client, naver):
    naver.result = httpx.Response(200, json={"code": 1, "message": "출발지와 도착지가 동일합니다."})
    body = post(client).json()
    assert body["travelTimeMinutes"] == 0
    assert body["distanceMeters"] == 0
    assert body["path"] == [[37.55631, 126.92204], [37.555, 126.8978]]


@pytest.mark.parametrize("code", [2, 3, 5])
def test_no_route_codes_are_404_and_not_cached(client, naver, code):
    naver.result = httpx.Response(200, json={"code": code, "message": "x"})
    for _ in range(2):
        res = post(client)
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "ROUTE_NOT_FOUND"
    assert len(naver.calls) == 2


@pytest.mark.parametrize(
    "result",
    [
        httpx.ReadTimeout("timeout"),
        httpx.Response(500, text="error"),
        httpx.Response(401, text="unauthorized"),
        httpx.Response(200, json={"code": 0, "route": {}}),
        httpx.Response(200, text="not json"),
        httpx.Response(200, json={"code": 99, "message": "x"}),
    ],
)
def test_provider_failures_are_502(client, naver, result):
    naver.result = result
    res = post(client)
    assert res.status_code == 502
    assert res.json()["error"]["code"] == "ROUTE_PROVIDER_ERROR"


def test_naver_429_is_quota_exceeded(client, naver):
    naver.result = httpx.Response(429, text="Quota Exceeded")
    res = post(client)
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "ROUTE_QUOTA_EXCEEDED"


def test_missing_key_is_502_without_calling(client, naver, monkeypatch):
    monkeypatch.setattr(settings, "naver_client_secret", SecretStr(""))
    res = post(client)
    assert res.status_code == 502
    assert res.json()["error"]["code"] == "ROUTE_PROVIDER_ERROR"
    assert naver.calls == []


def test_daily_route_budget(client, naver, fake_redis, monkeypatch):
    monkeypatch.setattr(settings, "directions_route_daily_limit", 2)
    key = f"directions:count:route:{datetime.now(KST):%Y%m%d}"
    post(client)
    post(client, station_id=SEOUL_ID)
    assert fake_redis.values[key] == 2
    res = post(client)  # 세 번째 - 예산 초과, 부르지 않고 카운터도 그대로
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "ROUTE_QUOTA_EXCEEDED"
    assert len(naver.calls) == 2
    assert fake_redis.values[key] == 2


def test_unknown_station_is_404(client, naver):
    res = post(client, station_id="NOPE0001")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "STATION_NOT_FOUND"
    assert naver.calls == []


@pytest.mark.parametrize("origin", [{"lat": 0, "lng": 0}, {"lat": 37.5, "lng": 140.0}])
def test_origin_outside_korea_is_422(client, naver, origin):
    res = post(client, origin=origin)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"
    assert naver.calls == []


def test_rate_limit_per_ip(client, monkeypatch):
    monkeypatch.setattr(settings, "route_rate_limit_per_min", 3)
    for _ in range(3):
        assert post(client).status_code == 200
    res = post(client)
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "RATE_LIMITED"
    assert res.headers["Retry-After"] == "60"
    assert post(client, ip="5.6.7.8").status_code == 200  # 다른 IP는 따로 셈


def test_redis_down_still_returns_route(client, naver, monkeypatch):
    broken = BrokenRedis()
    monkeypatch.setattr(directions, "_redis", broken)
    monkeypatch.setattr(rate_limit, "_redis", broken)
    assert post(client).status_code == 200
    assert post(client).status_code == 200
    assert len(naver.calls) == 2
