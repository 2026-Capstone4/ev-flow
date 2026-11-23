"""추천 이동시간 3단계 - 다중 목적지 1회 → 자동차 길찾기 → 직선거리 추정 (2026-11-22 결정, 캐시 없음)"""

import time
from datetime import datetime

import httpx
import pytest
from pydantic import SecretStr

from app.config import settings
from app.schemas.base import KST
from app.services import directions
from app.services import recommendations as rec

# conftest가 따로 없어 다른 테스트 파일의 도우미 · 픽스처를 그대로 가져다 씀
from tests.test_recommendations import ORIGIN, station
from tests.test_routes import fake_redis  # noqa: F401
from tests.test_routes_kakao import kakao_ok

TODAY = f"{datetime.now(KST):%Y%m%d}"
MULTI_KEY = f"directions:count:multi:{TODAY}"
REC_CAR_KEY = f"directions:count:rec_car:{TODAY}"
ROUTE_KEY = f"directions:count:route:{TODAY}"


class Kakao:
    """카카오 대역 - POST는 다중 목적지, GET은 자동차 길찾기 응답을 돌려줌. 예외면 던짐"""

    def __init__(self):
        self.posts, self.gets = [], []
        self.multi = None
        self.car = kakao_ok(duration_sec=300, distance=1500)
        self.multi_delay = 0

    def post(self, url, json=None, headers=None):
        self.posts.append({"url": url, "json": json})
        time.sleep(self.multi_delay)
        if isinstance(self.multi, Exception):
            raise self.multi
        return self.multi

    def get(self, url, params=None, headers=None):
        self.gets.append({"url": url, "params": params})
        return self.car


def multi_ok(rows):
    """rows: (key, result_code, 초, m)"""
    return httpx.Response(
        200,
        json={
            "trans_id": "x",
            "routes": [
                {
                    "key": key,
                    "result_code": code,
                    "result_msg": "x",
                    **({"summary": {"duration": sec, "distance": m}} if code == 0 else {}),
                }
                for key, code, sec, m in rows
            ],
        },
    )


@pytest.fixture
def kakao(monkeypatch, fake_redis):  # noqa: F811
    fake = Kakao()
    monkeypatch.setattr(directions, "_client", fake)
    monkeypatch.setattr(settings, "directions_provider", "kakao")
    monkeypatch.setattr(settings, "kakao_priority", "DISTANCE")
    monkeypatch.setattr(settings, "kakao_rest_api_key", SecretStr("test-kakao-key"))
    return fake


def cands(*rows):
    """rows: (충전소 ID, 직선거리 km)"""
    return [(station(sid, lat=ORIGIN[0] + km / 111, lng=ORIGIN[1]), km) for sid, km in rows]


def test_multi_once_for_all_candidates(kakao, fake_redis):  # noqa: F811
    kakao.multi = multi_ok([("A", 0, 600, 3000), ("B", 104, 0, 0), ("C", 1, 0, 0)])
    result = rec.travel_times(ORIGIN, cands(("A", 1.2), ("B", 0.0), ("C", 2.4), ("FAR", 10.5)))
    # 한 번만 부르고, 10km 밖은 보내지 않음
    assert len(kakao.posts) == 1 and kakao.gets == []
    body = kakao.posts[0]["json"]
    assert [d["key"] for d in body["destinations"]] == ["A", "B", "C"]
    assert body["radius"] == 10_000 and body["priority"] == "DISTANCE"
    assert body["origin"] == {"x": str(ORIGIN[1]), "y": str(ORIGIN[0])}
    assert fake_redis.values[MULTI_KEY] == 1
    assert result["A"].source == "directions" and result["A"].display_minutes == 10
    assert result["A"].distance_m == 3000 and result["A"].fetched_at
    # 104(5m 이내)는 0분
    assert result["B"].source == "directions" and result["B"].display_minutes == 0
    # 그곳만 실패한 코드 · 10km 밖은 직선거리 추정 (2분 + 시속 24km)
    assert result["C"] == rec.Travel(8.0, 8, 2400, "estimate")
    assert result["FAR"].source == "estimate"


def test_multi_budget_over_falls_back_to_car(kakao, fake_redis, monkeypatch):  # noqa: F811
    monkeypatch.setattr(settings, "directions_multi_daily_limit", 0)
    result = rec.travel_times(ORIGIN, cands(("A", 1.0), ("B", 2.0)))
    assert kakao.posts == [] and len(kakao.gets) == 2
    # 이어 쓰기 몫에서 후보 수만큼 잡고, 길찾기 화면 몫은 건드리지 않음
    assert fake_redis.values[REC_CAR_KEY] == 2
    assert ROUTE_KEY not in fake_redis.values
    assert {t.source for t in result.values()} == {"directions"}
    assert result["A"].display_minutes == 5


def test_kakao_quota_marks_multi_exhausted_for_today(kakao, fake_redis):  # noqa: F811
    kakao.multi = httpx.Response(400, json={"code": -10, "msg": "quota"})
    rec.travel_times(ORIGIN, cands(("A", 1.0)))
    assert len(kakao.posts) == 1 and len(kakao.gets) == 1
    assert f"directions:multi_exhausted:{TODAY}" in fake_redis.values
    # 오늘은 다중 목적지를 더 부르지 않고 바로 자동차 길찾기로
    rec.travel_times(ORIGIN, cands(("A", 1.0)))
    assert len(kakao.posts) == 1 and len(kakao.gets) == 2


def test_car_budget_short_estimates_all_without_calls(kakao, fake_redis, monkeypatch):  # noqa: F811
    monkeypatch.setattr(settings, "directions_multi_daily_limit", 0)
    monkeypatch.setattr(settings, "directions_rec_car_daily_limit", 3)
    result = rec.travel_times(ORIGIN, cands(("A", 1.0), ("B", 2.0), ("C", 3.0), ("D", 4.0)))
    assert kakao.gets == []
    assert {t.source for t in result.values()} == {"estimate"}
    # 잡지 못한 몫은 되돌려 둠 - 후보가 적은 다음 요청은 쓸 수 있음
    assert fake_redis.values[REC_CAR_KEY] == 0


@pytest.mark.parametrize(
    "error", [httpx.ConnectError("down"), httpx.Response(500, text="error"), httpx.Response(200)]
)
def test_multi_failure_estimates_without_car(kakao, error):
    kakao.multi = error
    result = rec.travel_times(ORIGIN, cands(("A", 1.0)))
    # 오류는 이어 쓰기로 넘기지 않음 - 자동차 길찾기 예산을 아낌
    assert kakao.gets == []
    assert result["A"].source == "estimate"


def test_multi_timeout_estimates(kakao, monkeypatch):
    kakao.multi = multi_ok([("A", 0, 600, 3000)])
    kakao.multi_delay = 0.3
    monkeypatch.setattr(rec, "DIRECTIONS_WAIT_SEC", 0.05)
    result = rec.travel_times(ORIGIN, cands(("A", 1.0)))
    assert result["A"].source == "estimate" and kakao.gets == []


def test_naver_has_no_multi_so_uses_car(kakao, fake_redis, monkeypatch):  # noqa: F811
    monkeypatch.setattr(settings, "directions_provider", "naver")
    monkeypatch.setattr(settings, "naver_client_id", "id")
    monkeypatch.setattr(settings, "naver_client_secret", SecretStr("secret"))
    kakao.car = httpx.Response(500)  # 응답 모양은 상관없음 - 부르는 길만 봄
    result = rec.travel_times(ORIGIN, cands(("A", 1.0)))
    assert kakao.posts == [] and kakao.gets[0]["url"] == directions.NAVER_URL
    assert MULTI_KEY not in fake_redis.values and fake_redis.values[REC_CAR_KEY] == 1
    assert result["A"].source == "estimate"


def test_missing_key_estimates_without_counting(kakao, fake_redis, monkeypatch):  # noqa: F811
    monkeypatch.setattr(settings, "kakao_rest_api_key", SecretStr(""))
    result = rec.travel_times(ORIGIN, cands(("A", 1.0)))
    assert kakao.posts == [] and kakao.gets == []
    assert not [k for k in fake_redis.values if k.startswith("directions:count:")]
    assert result["A"].source == "estimate"
