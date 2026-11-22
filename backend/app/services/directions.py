"""길찾기 호출 + Redis 경로 캐시 - 길찾기(POST /routes)와 추천 이동시간이 같이 씀 (MAP-02)

- 제공자: .env DIRECTIONS_PROVIDER로 고름. kakao(카카오모빌리티 자동차 길찾기, 기본) · naver(네이버 Directions 5).
  둘 다 같은 Route([위도, 경도] 경로)를 돌려줘 화면 · 추천 코드는 제공자를 모름. 바꿀 때는 .env만 고치고 재시작
- 캐시: 제공자 + 출발 좌표(소수 4자리, 약 10m) + 충전소 ID, 30분. 추천에서 받은 경로를 길찾기가 다시 부르지 않음
- 하루 예산: 실제 호출만 서버 전체에서 KST 하루 단위로 셈 (DIRECTIONS_DAILY_LIMIT).
  넘으면 길찾기는 503, 추천은 직선거리 추정으로 바꿈 - 출발 좌표를 바꿔 캐시를 피하는 요청이 한도를 다 쓰지 못하게 함
- Redis 장애 시 캐시 · 카운터를 건너뛰고 호출만 함 - 길찾기 자체는 막지 않음
"""

import json
import logging
from dataclasses import asdict, dataclass, replace
from datetime import UTC, datetime, timedelta

import httpx
import redis

from app.api.errors import ApiError
from app.config import settings
from app.schemas.base import KST

logger = logging.getLogger(__name__)
# httpx는 INFO에서 요청 URL을 찍음 - URL에 사용자 출발 좌표가 들어가 로그에 남지 않게 함 (SER-002)
logging.getLogger("httpx").setLevel(logging.WARNING)

TIMEOUT_SEC = 5
CACHE_TTL_SEC = 30 * 60
COORD_DIGITS = 4
BUDGET_KEY_TTL_SEC = 2 * 24 * 3600  # 지난날 카운터는 다음 날 중에 사라지게 함

NAVER_URL = "https://maps.apigw.ntruss.com/map-direction/v1/driving"
NAVER_OPTION = "trafast"  # 실시간 빠른길
# 네이버 응답 code - 0 성공, 1 출발지 = 도착지, 2 출발지 · 도착지가 도로 주변이 아님, 3 자동차 경로 없음, 5 경로가 너무 김
NAVER_NO_ROUTE_CODES = {2, 3, 5}

KAKAO_URL = "https://apis-navi.kakaomobility.com/v1/directions"
# 카카오 result_code - 0 성공, 104 출발지 · 도착지가 5m 이내, 1 경로 없음, 102 · 103 출발지 · 도착지 주변 도로 없음,
# 105 · 106 출발지 · 도착지 주변 도로에 교통 장애 (developers.kakaomobility.com 길찾기 API 레퍼런스)
KAKAO_SAME_PLACE_CODE = 104
KAKAO_NO_ROUTE_CODES = {1, 102, 103, 105, 106}
KAKAO_QUOTA_ERROR_CODE = -10  # HTTP 400과 같이 옴 - 허용된 요청 횟수 초과

_redis = redis.Redis.from_url(settings.redis_url, socket_timeout=1, socket_connect_timeout=1)
# 연결을 재사용해 TLS 연결 시간을 줄임 (스레드 간 공유 가능)
_client = httpx.Client(timeout=TIMEOUT_SEC)


@dataclass(frozen=True)
class Route:
    duration_sec: int
    distance_m: int
    path: list[tuple[float, float]]  # [위도, 경도] - 두 제공자 원본은 [경도, 위도]
    # 제공자를 실제로 부른 시각(ISO, UTC) - 추천에서 AI 채점 함수가 경로 나이(30분 미만)를 봄
    fetched_at: str | None = None


class DirectionsUnavailable(ApiError):
    """키 없음 · 타임아웃 · 제공자 오류 - 추천은 이걸 잡아 직선거리 추정으로 바꿈"""

    def __init__(self):
        super().__init__(
            502, "ROUTE_PROVIDER_ERROR", "경로를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
        )


class DirectionsQuotaExceeded(ApiError):
    """하루 예산 소진 · 제공자 한도 초과 응답 - 추천은 이걸 잡아 직선거리 추정으로 바꿈"""

    def __init__(self):
        super().__init__(503, "ROUTE_QUOTA_EXCEEDED", "지금은 길찾기를 이용할 수 없습니다.")


def _route_not_found() -> ApiError:
    return ApiError(404, "ROUTE_NOT_FOUND", "경로를 찾을 수 없습니다.")


def _cache_get(key: str) -> Route | None:
    try:
        raw = _redis.get(key)
    except redis.RedisError:
        logger.warning("경로 캐시 읽기 실패 - 캐시 없이 호출함")
        return None
    if raw is None:
        return None
    data = json.loads(raw)
    return Route(
        data["duration_sec"],
        data["distance_m"],
        [tuple(p) for p in data["path"]],
        data.get("fetched_at") or _fetched_from_ttl(key),
    )


def _fetched_from_ttl(key: str) -> str | None:
    """조회 시각이 없는 예전 캐시 항목 - 남은 TTL로 저장 시각을 되짚음 (배포 뒤 30분 동안만 생김)"""
    try:
        left = _redis.ttl(key)
    except redis.RedisError:
        return None
    if not isinstance(left, int) or left < 0:
        return None
    return (datetime.now(UTC) - timedelta(seconds=CACHE_TTL_SEC - left)).isoformat()


def _cache_set(key: str, route: Route) -> None:
    try:
        _redis.set(key, json.dumps(asdict(route)), ex=CACHE_TTL_SEC)
    except redis.RedisError:
        logger.warning("경로 캐시 저장 실패")


def _count_call() -> None:
    """오늘(KST) 서버 전체 실제 호출 수를 올림 - 예산을 넘으면 503. 실패한 호출도 셈 (제공자 쪽에서도 호출로 잡힘)"""
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


def _get(url: str, params: dict, headers: dict) -> httpx.Response:
    """제공자 GET 호출 - 네트워크 오류 · 429는 여기서 공통으로 처리함"""
    try:
        resp = _client.get(url, params=params, headers=headers)
    except httpx.HTTPError as e:
        # 예외 메시지에 좌표가 든 URL이 들어감 - 예외 종류만 남김
        logger.warning("Directions 호출 실패 - %s", type(e).__name__)
        raise DirectionsUnavailable() from None
    # 두 제공자 모두 한도 초과를 429로 알려 줌
    if resp.status_code == 429:
        logger.warning("Directions 한도 초과 응답(429)")
        raise DirectionsQuotaExceeded()
    return resp


def _request_naver(origin: tuple[float, float], dest: tuple[float, float]) -> Route:
    # 키가 없으면 호출하지 않고 실패로 돌림 - 예산도 쓰지 않음
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
        "option": NAVER_OPTION,
    }
    resp = _get(NAVER_URL, params, headers)
    # 200이 아니면 키 오류 · 서버 오류 - 경로 없음과 구분해 502
    if resp.status_code != 200:
        logger.warning("Directions HTTP %d", resp.status_code)
        raise DirectionsUnavailable()
    try:
        body = resp.json()
        code = body.get("code")
        # 이미 충전소에 있음 - 0분 · 두 점 경로
        if code == 1:
            return Route(0, 0, [origin, dest])
        # 도로가 없거나 경로가 너무 김 - 다시 불러도 같아 404
        if code in NAVER_NO_ROUTE_CODES:
            raise _route_not_found()
        # 그 밖의 code는 알 수 없는 실패
        if code != 0:
            logger.warning("Directions 응답 code %s", code)
            raise DirectionsUnavailable()
        route = body["route"][NAVER_OPTION][0]
        summary = route["summary"]
        return Route(
            duration_sec=round(summary["duration"] / 1000),  # 밀리초 → 초
            distance_m=summary["distance"],
            path=[(lat, lng) for lng, lat in route["path"]],
        )
    except (ValueError, KeyError, IndexError, TypeError):
        logger.warning("Directions 응답 형식이 예상과 다름")
        raise DirectionsUnavailable() from None


def _request_kakao(origin: tuple[float, float], dest: tuple[float, float]) -> Route:
    # 키가 없으면 호출하지 않고 실패로 돌림 - 예산도 쓰지 않음
    if not settings.kakao_rest_api_key.get_secret_value():
        logger.warning("Directions 키가 없어 경로를 부르지 않음 - .env KAKAO_REST_API_KEY")
        raise DirectionsUnavailable()
    _count_call()
    headers = {"Authorization": f"KakaoAK {settings.kakao_rest_api_key.get_secret_value()}"}
    params = {
        "origin": f"{origin[1]},{origin[0]}",  # 경도,위도 순서
        "destination": f"{dest[1]},{dest[0]}",
        "priority": settings.kakao_priority,
    }
    resp = _get(KAKAO_URL, params, headers)
    # 200이 아니면 오류 본문의 code로 한도 초과인지 가림
    if resp.status_code != 200:
        try:
            error_code = resp.json().get("code")
        except (ValueError, AttributeError):
            error_code = None
        # 카카오는 한도 초과를 400 + code -10으로도 알려 줌
        if error_code == KAKAO_QUOTA_ERROR_CODE:
            logger.warning("Directions 한도 초과 응답(code -10)")
            raise DirectionsQuotaExceeded()
        logger.warning("Directions HTTP %d code %s", resp.status_code, error_code)
        raise DirectionsUnavailable()
    try:
        route = resp.json()["routes"][0]
        code = route.get("result_code")
        # 출발지와 도착지가 5m 이내 - 이미 충전소에 있음. 0분 · 두 점 경로
        if code == KAKAO_SAME_PLACE_CODE:
            return Route(0, 0, [origin, dest])
        # 도로가 없거나 교통 장애로 경로를 못 찾음 - 404
        if code in KAKAO_NO_ROUTE_CODES:
            raise _route_not_found()
        # 그 밖의 code는 알 수 없는 실패
        if code != 0:
            logger.warning("Directions 응답 result_code %s", code)
            raise DirectionsUnavailable()
        path = []
        for section in route["sections"]:
            for road in section["roads"]:
                v = road["vertexes"]
                # vertexes는 [경도, 위도, 경도, 위도, …]로 한 줄로 이어져 있어 두 개씩 끊어 [위도, 경도]로 바꿈
                path.extend((v[i + 1], v[i]) for i in range(0, len(v) - 1, 2))
        # 성공인데 좌표가 없으면 선을 그릴 수 없어 실패로 봄
        if not path:
            raise KeyError("vertexes")
        summary = route["summary"]
        return Route(
            duration_sec=summary["duration"],  # 이미 초 단위
            distance_m=summary["distance"],
            path=path,
        )
    except (ValueError, KeyError, IndexError, TypeError):
        logger.warning("Directions 응답 형식이 예상과 다름")
        raise DirectionsUnavailable() from None


_REQUESTERS = {"naver": _request_naver, "kakao": _request_kakao}


def get_route(origin: tuple[float, float], station_id: str, dest: tuple[float, float]) -> Route:
    """출발 좌표 → 충전소 경로. 캐시에 있으면 제공자를 부르지 않음"""
    provider = settings.directions_provider
    origin = (round(origin[0], COORD_DIGITS), round(origin[1], COORD_DIGITS))
    # 제공자를 키에 넣어 바꿨을 때 다른 제공자의 경로가 섞여 나오지 않게 함
    key = f"route:v2:{provider}:{origin[0]:.{COORD_DIGITS}f}:{origin[1]:.{COORD_DIGITS}f}:{station_id}"
    cached = _cache_get(key)
    if cached is not None:
        return cached
    route = replace(_REQUESTERS[provider](origin, dest), fetched_at=datetime.now(UTC).isoformat())
    _cache_set(key, route)
    return route
