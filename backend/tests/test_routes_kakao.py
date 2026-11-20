"""길찾기(POST /routes) - 카카오모빌리티 제공자. 공통 동작(캐시 · 예산 · 호출 제한)은 test_routes.py에서 확인함"""

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.config import settings
from app.main import app
from app.services import directions

# conftest가 따로 없어 test_routes.py의 도우미 · 픽스처(db, fake_redis)를 그대로 가져다 씀
from tests.test_routes import MAPO_ID, FakeClient, db, fake_redis, post  # noqa: F401


def kakao_ok(duration_sec=487, distance=2400, roads=None):
    """카카오 성공 응답 - vertexes는 [경도, 위도, 경도, 위도, …]로 한 줄로 이어짐"""
    if roads is None:
        roads = [[126.9220, 37.5563, 126.9180, 37.5560], [126.9180, 37.5560, 126.8978, 37.5550]]
    return httpx.Response(
        200,
        json={
            "routes": [
                {
                    "result_code": 0,
                    "result_msg": "길찾기 성공",
                    "summary": {"duration": duration_sec, "distance": distance},
                    "sections": [{"roads": [{"vertexes": v} for v in roads]}],
                }
            ]
        },
    )


def kakao_code(code):
    return httpx.Response(200, json={"routes": [{"result_code": code, "result_msg": "x"}]})


@pytest.fixture
def kakao(monkeypatch):
    fake = FakeClient()
    fake.result = kakao_ok()
    monkeypatch.setattr(directions, "_client", fake)
    monkeypatch.setattr(settings, "directions_provider", "kakao")
    monkeypatch.setattr(settings, "kakao_priority", "DISTANCE")
    monkeypatch.setattr(settings, "kakao_rest_api_key", SecretStr("test-kakao-key"))
    return fake


@pytest.fixture
def client(fake_redis, kakao, db):  # noqa: F811
    return TestClient(app)


def test_returns_route_with_lat_lng_path(client, kakao, db):  # noqa: F811
    res = post(client)
    assert res.status_code == 200
    assert res.json() == {
        "stationId": MAPO_ID,
        "travelTimeMinutes": 8,  # 487초 → 8분 (카카오는 이미 초 단위)
        "distanceMeters": 2400,
        # 도로마다 끊긴 vertexes를 이어 붙이고 [위도, 경도]로 바꿈
        "path": [
            [37.5563, 126.9220],
            [37.5560, 126.9180],
            [37.5560, 126.9180],
            [37.5550, 126.8978],
        ],
        "provider": "kakao",
    }
    call = kakao.calls[0]
    assert call["url"] == directions.KAKAO_URL
    # 카카오에도 경도,위도 순서 · 소수 4자리로 반올림한 출발 좌표를 보냄
    assert call["params"] == {
        "origin": "126.922,37.5563",
        "destination": "126.8978,37.555",
        "priority": "DISTANCE",
    }
    assert call["headers"] == {"Authorization": "KakaoAK test-kakao-key"}
    assert db.closed


def test_priority_comes_from_settings(client, kakao, monkeypatch):
    monkeypatch.setattr(settings, "kakao_priority", "TIME")
    post(client)
    assert kakao.calls[0]["params"]["priority"] == "TIME"


def test_already_at_station_returns_zero_minutes(client, kakao):
    kakao.result = kakao_code(104)  # 출발지 · 도착지가 5m 이내
    body = post(client).json()
    assert body["travelTimeMinutes"] == 0
    assert body["distanceMeters"] == 0
    assert body["path"] == [[37.5563, 126.922], [37.555, 126.8978]]


@pytest.mark.parametrize("code", [1, 102, 103, 105, 106])
def test_no_route_codes_are_404_and_not_cached(client, kakao, code):
    kakao.result = kakao_code(code)
    for _ in range(2):
        res = post(client)
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "ROUTE_NOT_FOUND"
    assert len(kakao.calls) == 2


@pytest.mark.parametrize(
    "result",
    [
        httpx.ReadTimeout("timeout"),
        httpx.Response(500, json={"code": -1, "msg": "internal"}),
        httpx.Response(401, json={"code": -401, "msg": "unauthorized"}),
        httpx.Response(403, json={"code": -3, "msg": "disabled"}),
        httpx.Response(400, text="not json"),
        httpx.Response(200, json={"routes": []}),
        httpx.Response(200, text="not json"),
        kakao_code(99),
        kakao_ok(roads=[]),  # 성공인데 좌표가 없음
    ],
)
def test_provider_failures_are_502(client, kakao, result):
    kakao.result = result
    res = post(client)
    assert res.status_code == 502
    assert res.json()["error"]["code"] == "ROUTE_PROVIDER_ERROR"


@pytest.mark.parametrize(
    "result",
    [
        httpx.Response(429, json={"code": -10, "msg": "limit"}),
        httpx.Response(400, json={"code": -10, "msg": "API limit has been exceeded."}),
    ],
)
def test_quota_responses_are_503(client, kakao, result):
    kakao.result = result
    res = post(client)
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "ROUTE_QUOTA_EXCEEDED"


def test_missing_key_is_502_without_calling(client, kakao, monkeypatch):
    monkeypatch.setattr(settings, "kakao_rest_api_key", SecretStr(""))
    res = post(client)
    assert res.status_code == 502
    assert res.json()["error"]["code"] == "ROUTE_PROVIDER_ERROR"
    assert kakao.calls == []


def test_cache_is_kept_per_provider(client, kakao, fake_redis, monkeypatch):  # noqa: F811
    post(client)
    assert f"route:v2:kakao:37.5563:126.9220:{MAPO_ID}" in fake_redis.values
    # 네이버로 바꾸면 카카오 캐시를 쓰지 않고 네이버를 부름
    monkeypatch.setattr(settings, "directions_provider", "naver")
    monkeypatch.setattr(settings, "naver_client_id", "test-id")
    monkeypatch.setattr(settings, "naver_client_secret", SecretStr("test-secret"))
    kakao.result = httpx.Response(
        200,
        json={
            "code": 0,
            "route": {
                "trafast": [
                    {
                        "summary": {"duration": 600_000, "distance": 3000},
                        "path": [[126.9220, 37.5563], [126.8978, 37.5550]],
                    }
                ]
            },
        },
    )
    res = post(client)
    assert res.json()["distanceMeters"] == 3000
    assert kakao.calls[1]["url"] == directions.NAVER_URL
