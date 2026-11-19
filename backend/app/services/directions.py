"""네이버 Directions 5 호출 + Redis 경로 캐시 - 길찾기(POST /routes)와 추천 이동시간이 같이 씀 (MAP-02)

- 캐시: 출발 좌표(소수 4자리, 약 10m) + 충전소 ID, 30분. 추천에서 받은 경로를 길찾기가 다시 부르지 않음
- 하루 예산: 실제 호출만 서버 전체에서 KST 하루 단위로 셈 (월 60,000회 ÷ 30일 = 2,000회).
  넘으면 길찾기는 503, 추천은 직선거리 추정으로 바꿈 - 출발 좌표를 바꿔 캐시를 피하는 요청이 한도를 다 쓰지 못하게 함
- Redis 장애 시 캐시 · 카운터를 건너뛰고 호출만 함 - 길찾기 자체는 막지 않음
"""

import json
import logging
from dataclasses import asdict, dataclass
from datetime import datetime

import httpx
import redis

from app.api.errors import ApiError
from app.config import settings
from app.schemas.base import KST

logger = logging.getLogger(__name__)
# httpx는 INFO에서 요청 URL을 찍음 - URL에 사용자 출발 좌표가 들어가 로그에 남지 않게 함 (SER-002)
logging.getLogger("httpx").setLevel(logging.WARNING)

DIRECTIONS_URL = "https://maps.apigw.ntruss.com/map-direction/v1/driving"
OPTION = "trafast"  # 실시간 빠른길 - 이동시간 측정(export_travel_times.py)과 같은 기준
TIMEOUT_SEC = 5
CACHE_TTL_SEC = 30 * 60
COORD_DIGITS = 4
BUDGET_KEY_TTL_SEC = 2 * 24 * 3600  # 지난날 카운터는 다음 날 중에 사라지게 함

# 응답 code - 0 성공, 1 출발지 = 도착지, 2 출발지 · 도착지가 도로 주변이 아님, 3 자동차 경로 없음, 5 경로가 너무 김
NO_ROUTE_CODES = {2, 3, 5}

_redis = redis.Redis.from_url(settings.redis_url, socket_timeout=1, socket_connect_timeout=1)
# 연결을 재사용해 TLS 연결 시간을 줄임 (스레드 간 공유 가능)
_client = httpx.Client(timeout=TIMEOUT_SEC)


@dataclass(frozen=True)
class Route:
    duration_sec: int
    distance_m: int
    path: list[tuple[float, float]]  # [위도, 경도] - Directions 원본은 [경도, 위도]


class DirectionsUnavailable(ApiError):
    """키 없음 · 타임아웃 · 네이버 오류 - 추천은 이걸 잡아 직선거리 추정으로 바꿈"""

    def __init__(self):
        super().__init__(
            502, "ROUTE_PROVIDER_ERROR", "경로를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
        )


class DirectionsQuotaExceeded(ApiError):
    """하루 예산 소진 · 네이버 429 - 추천은 이걸 잡아 직선거리 추정으로 바꿈"""

    def __init__(self):
        super().__init__(503, "ROUTE_QUOTA_EXCEEDED", "지금은 길찾기를 이용할 수 없습니다.")


def _cache_get(key: str) -> Route | None:
    try:
        raw = _redis.get(key)
    except redis.RedisError:
        logger.warning("경로 캐시 읽기 실패 - 캐시 없이 호출함")
        return None
    if raw is None:
        return None
    data = json.loads(raw)
    return Route(data["duration_sec"], data["distance_m"], [tuple(p) for p in data["path"]])


def _cache_set(key: str, route: Route) -> None:
    try:
        _redis.set(key, json.dumps(asdict(route)), ex=CACHE_TTL_SEC)
    except redis.RedisError:
        logger.warning("경로 캐시 저장 실패")


def _count_call() -> None:
    """오늘(KST) 서버 전체 실제 호출 수를 올림 - 예산을 넘으면 503. 실패한 호출도 셈 (네이버 쪽에서도 호출로 잡힘)"""
    key = f"directions:count:{datetime.now(KST):%Y%m%d}"
    try:
        pipe = _redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, BUDGET_KEY_TTL_SEC, nx=True)
        count, _ = pipe.execute()
    except redis.RedisError:
        logger.warning("Directions 하루 카운터 갱신 실패 - 세지 않고 호출함")
        return
    if count > settings.directions_daily_limit:
        logger.warning(
            "Directions 하루 예산 도달 (%d회) - 호출하지 않음", settings.directions_daily_limit
        )
        raise DirectionsQuotaExceeded()


def _request(origin: tuple[float, float], dest: tuple[float, float]) -> Route:
    if not settings.naver_client_id or not settings.naver_client_secret.get_secret_value():
        logger.warning(
            "Directions 키가 없어 경로를 부르지 않음 - .env NAVER_CLIENT_ID · NAVER_CLIENT_SECRET"
        )
        raise DirectionsUnavailable()
    _count_call()
    headers = {
        "x-ncp-apigw-api-key-id": settings.naver_client_id,
        "x-ncp-apigw-api-key": settings.naver_client_secret.get_secret_value(),
    }
    params = {
        "start": f"{origin[1]},{origin[0]}",  # 경도,위도 순서
        "goal": f"{dest[1]},{dest[0]}",
        "option": OPTION,
    }
    try:
        resp = _client.get(DIRECTIONS_URL, params=params, headers=headers)
    except httpx.HTTPError as e:
        # 예외 메시지에 좌표가 든 URL이 들어감 - 예외 종류만 남김
        logger.warning("Directions 호출 실패 - %s", type(e).__name__)
        raise DirectionsUnavailable() from None
    if resp.status_code == 429:
        logger.warning("Directions 한도 초과 응답(429)")
        raise DirectionsQuotaExceeded()
    if resp.status_code != 200:
        logger.warning("Directions HTTP %d", resp.status_code)
        raise DirectionsUnavailable()
    try:
        body = resp.json()
        code = body.get("code")
        if code == 1:  # 이미 충전소에 있음 - 0분 · 두 점 경로
            return Route(0, 0, [origin, dest])
        if code in NO_ROUTE_CODES:
            raise ApiError(404, "ROUTE_NOT_FOUND", "경로를 찾을 수 없습니다.")
        if code != 0:
            logger.warning("Directions 응답 code %s", code)
            raise DirectionsUnavailable()
        route = body["route"][OPTION][0]
        summary = route["summary"]
        return Route(
            duration_sec=round(summary["duration"] / 1000),
            distance_m=summary["distance"],
            path=[(lat, lng) for lng, lat in route["path"]],
        )
    except (ValueError, KeyError, IndexError, TypeError):
        logger.warning("Directions 응답 형식이 예상과 다름")
        raise DirectionsUnavailable() from None


def get_route(origin: tuple[float, float], station_id: str, dest: tuple[float, float]) -> Route:
    """출발 좌표 → 충전소 경로. 캐시에 있으면 네이버를 부르지 않음"""
    origin = (round(origin[0], COORD_DIGITS), round(origin[1], COORD_DIGITS))
    key = f"route:v1:{origin[0]:.{COORD_DIGITS}f}:{origin[1]:.{COORD_DIGITS}f}:{station_id}"
    cached = _cache_get(key)
    if cached is not None:
        return cached
    route = _request(origin, dest)
    _cache_set(key, route)
    return route
