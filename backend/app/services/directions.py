"""길찾기 호출 - 길찾기(POST /routes)와 추천 이동시간이 같이 씀 (MAP-02)

- 제공자: .env DIRECTIONS_PROVIDER로 고름. kakao(카카오모빌리티 자동차 길찾기, 기본) · naver(네이버 Directions 5).
  둘 다 같은 Route([위도, 경도] 경로)를 돌려줘 화면 · 추천 코드는 제공자를 모름. 바꿀 때는 .env만 고치고 재시작
- 캐시 없음 (2026-11-22 결정): 카카오 데브톡 151653 "임시 캐싱 등의 방법으로 API 호출 및 이용은 금지" 답변에 맞춤.
  결과는 받은 요청에만 쓰고 저장하지 않음
- 추천 이동시간은 카카오 다중 목적지 길찾기 1회(최대 30곳 · 반경 10km, 경로선 없음)로 받음 - 1회 = 쿼터 1건
- 하루 예산: 실제 호출만 서버 전체에서 KST 하루 단위로 셈. 카운터 세 개를 따로 둠
  - multi: 다중 목적지 (DIRECTIONS_MULTI_DAILY_LIMIT) - 넘으면 추천이 자동차 길찾기로 이어 씀
  - route: 길찾기 화면 (DIRECTIONS_ROUTE_DAILY_LIMIT) - 넘으면 503. 추천이 이 몫을 쓰지 않음
  - rec_car: 추천 이어 쓰기 (DIRECTIONS_REC_CAR_DAILY_LIMIT) - 넘으면 추천은 직선거리 추정
- Redis 장애 시 카운터를 건너뛰고 호출만 함 - 길찾기 자체는 막지 않음
"""

import logging
from dataclasses import dataclass, replace
from datetime import UTC, datetime

import httpx
import redis

from app.api.errors import ApiError
from app.config import settings
from app.schemas.base import KST

logger = logging.getLogger(__name__)
# httpx는 INFO에서 요청 URL을 찍음 - URL에 사용자 출발 좌표가 들어가 로그에 남지 않게 함 (SER-002)
logging.getLogger("httpx").setLevel(logging.WARNING)

TIMEOUT_SEC = 5
BUDGET_KEY_TTL_SEC = 2 * 24 * 3600  # 지난날 카운터 · 소진 표시는 다음 날 중에 사라지게 함

# 하루 예산 이름 - Redis 키 directions:count:{이름}:{KST 날짜}
MULTI = "multi"
ROUTE = "route"
REC_CAR = "rec_car"

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
KAKAO_MULTI_URL = "https://apis-navi.kakaomobility.com/v1/destinations/directions"
KAKAO_MULTI_MAX = 30  # 다중 목적지 한 번에 보낼 수 있는 곳 수
KAKAO_MULTI_RADIUS_M = 10_000  # 다중 목적지 반경 상한 - 이보다 먼 곳은 보내지 않음

_redis = redis.Redis.from_url(settings.redis_url, socket_timeout=1, socket_connect_timeout=1)
# 연결을 재사용해 TLS 연결 시간을 줄임 (스레드 간 공유 가능)
_client = httpx.Client(timeout=TIMEOUT_SEC)


@dataclass(frozen=True)
class Route:
    duration_sec: int
    distance_m: int
    path: list[tuple[float, float]]  # [위도, 경도] - 두 제공자 원본은 [경도, 위도]
    # 제공자를 부른 시각(ISO, UTC) - 추천에서 AI 채점 함수가 경로 나이(30분 미만)를 봄. 캐시가 없어 늘 방금 시각
    fetched_at: str | None = None


class DirectionsUnavailable(ApiError):
    """키 없음 · 타임아웃 · 제공자 오류 - 추천은 이걸 잡아 직선거리 추정으로 바꿈 (이어 쓰기로 넘기지 않음)"""

    def __init__(self):
        super().__init__(
            502, "ROUTE_PROVIDER_ERROR", "경로를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
        )


class DirectionsQuotaExceeded(ApiError):
    """하루 예산 소진 · 제공자 한도 초과 응답 - 추천은 다음 단계(자동차 길찾기 → 직선거리 추정)로 넘어감"""

    def __init__(self):
        super().__init__(503, "ROUTE_QUOTA_EXCEEDED", "지금은 길찾기를 이용할 수 없습니다.")


def _route_not_found() -> ApiError:
    return ApiError(404, "ROUTE_NOT_FOUND", "경로를 찾을 수 없습니다.")


def _today() -> str:
    return f"{datetime.now(KST):%Y%m%d}"


def _limit(budget: str) -> int:
    return {
        MULTI: settings.directions_multi_daily_limit,
        ROUTE: settings.directions_route_daily_limit,
        REC_CAR: settings.directions_rec_car_daily_limit,
    }[budget]


def reserve(budget: str, n: int = 1) -> None:
    """오늘(KST) 예산에서 n건을 한 번에 잡음 - 남은 몫이 n보다 적으면 되돌리고 503

    실패한 호출도 셈 (제공자 쪽에서도 호출로 잡힘). 추천 이어 쓰기는 후보 수만큼 먼저 잡아 둔 뒤 부름
    """
    key = f"directions:count:{budget}:{_today()}"
    try:
        pipe = _redis.pipeline()
        pipe.incrby(key, n)
        pipe.expire(key, BUDGET_KEY_TTL_SEC, nx=True)
        count, _ = pipe.execute()
        # 한도를 넘으면 잡은 만큼 되돌림 - 남은 몫은 더 적은 요청(길찾기 1건 등)이 쓸 수 있게 둠
        if count > _limit(budget):
            _redis.decrby(key, n)
    except redis.RedisError:
        logger.warning("Directions 하루 카운터(%s) 갱신 실패 - 세지 않고 호출함", budget)
        return
    # 위에서 되돌린 경우 - 이번 요청은 부르지 않음
    if count > _limit(budget):
        logger.warning("Directions 하루 예산(%s %d건) 도달 - 호출하지 않음", budget, _limit(budget))
        raise DirectionsQuotaExceeded()


def _multi_exhausted_key() -> str:
    return f"directions:multi_exhausted:{_today()}"


def multi_exhausted_today() -> bool:
    """카카오가 오늘 다중 목적지 한도 초과로 답했는지 - 그랬으면 KST 자정까지 다중 목적지를 건너뜀"""
    try:
        return _redis.get(_multi_exhausted_key()) is not None
    except redis.RedisError:
        return False


def _mark_multi_exhausted() -> None:
    try:
        _redis.set(_multi_exhausted_key(), "1", ex=BUDGET_KEY_TTL_SEC)
    except redis.RedisError:
        logger.warning("다중 목적지 소진 표시 저장 실패")


def _get(url: str, params: dict, headers: dict) -> httpx.Response:
    """제공자 GET 호출 - 네트워크 오류 · 429는 여기서 공통으로 처리함"""
    return _send(lambda: _client.get(url, params=params, headers=headers))


def _send(call) -> httpx.Response:
    """제공자 호출 공통 - 네트워크 오류는 502, 429는 한도 초과로 바꿈"""
    try:
        resp = call()
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
    headers = {"Authorization": f"KakaoAK {settings.kakao_rest_api_key.get_secret_value()}"}
    params = {
        "origin": f"{origin[1]},{origin[0]}",  # 경도,위도 순서
        "destination": f"{dest[1]},{dest[0]}",
        "priority": settings.kakao_priority,
    }
    resp = _get(KAKAO_URL, params, headers)
    _check_kakao_status(resp)
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


def _check_kakao_status(resp: httpx.Response) -> None:
    """카카오 응답이 200이 아니면 오류 본문의 code로 한도 초과인지 가림"""
    # 200이면 본문 확인은 부른 쪽에서 함
    if resp.status_code == 200:
        return
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


_REQUESTERS = {"naver": _request_naver, "kakao": _request_kakao}


def get_route(
    origin: tuple[float, float], dest: tuple[float, float], budget: str | None = ROUTE
) -> Route:
    """출발 좌표 → 충전소 경로. 부를 때마다 제공자를 부름 (캐시 없음)

    budget: 셀 하루 예산 이름. None은 부른 쪽이 reserve로 이미 잡아 둔 경우 (추천 이어 쓰기)
    """
    provider = settings.directions_provider
    # 키가 없으면 예산을 쓰지 않고 바로 실패 - 제공자별 확인은 _request_*에서도 함
    if budget is not None and has_key(provider):
        reserve(budget)
    route = _REQUESTERS[provider](origin, dest)
    return replace(route, fetched_at=datetime.now(UTC).isoformat())


def has_key(provider: str | None = None) -> bool:
    """지금(또는 주어진) 제공자의 키가 .env에 있는지"""
    provider = provider or settings.directions_provider
    if provider == "kakao":
        return bool(settings.kakao_rest_api_key.get_secret_value())
    return bool(settings.naver_client_id and settings.naver_client_secret.get_secret_value())


@dataclass(frozen=True)
class TravelSummary:
    """다중 목적지 한 곳의 결과 - 경로선은 없음"""

    duration_sec: int
    distance_m: int


def multi_supported() -> bool:
    """다중 목적지를 쓸 수 있는지 - 카카오 제공자이고 키가 있을 때만 (네이버에는 같은 API가 없음)"""
    return settings.directions_provider == "kakao" and has_key("kakao")


def get_travel_times(
    origin: tuple[float, float], dests: dict[str, tuple[float, float]]
) -> dict[str, TravelSummary | None]:
    """카카오 다중 목적지 길찾기 1회 - 곳마다 이동시간 · 거리. 못 찾은 곳은 None (그곳만 추정으로)

    dests: key(충전소 ID) → (위도, 경도). 최대 30곳 · 출발지에서 10km 안만 넣어야 함 (부른 쪽이 거름)
    예산 소진 · 한도 초과(429 · code -10)는 DirectionsQuotaExceeded, 그 밖의 실패는 DirectionsUnavailable
    """
    # 다중 목적지를 못 쓰는 설정이면 부르지 않음 - 추천은 multi_supported()를 먼저 보고 자동차 길찾기로 감
    if not multi_supported():
        raise DirectionsUnavailable()
    reserve(MULTI)
    priority = "TIME" if settings.kakao_priority == "RECOMMEND" else settings.kakao_priority
    body = {
        "origin": {"x": str(origin[1]), "y": str(origin[0])},  # x = 경도, y = 위도
        "destinations": [
            {"x": str(lng), "y": str(lat), "key": key} for key, (lat, lng) in dests.items()
        ],
        "radius": KAKAO_MULTI_RADIUS_M,
        "priority": priority,  # 다중 목적지는 TIME · DISTANCE만 받음
    }
    headers = {"Authorization": f"KakaoAK {settings.kakao_rest_api_key.get_secret_value()}"}
    # 429는 하루 한도가 아니라 순간 호출 제한일 수 있어 표시를 남기지 않음 - 이 요청만 이어 쓰기로 넘어감
    resp = _send(lambda: _client.post(KAKAO_MULTI_URL, json=body, headers=headers))
    try:
        _check_kakao_status(resp)
    except DirectionsQuotaExceeded:
        # code -10(허용된 요청 횟수 초과)은 오늘 한도를 다 쓴 것 - 자정까지 다시 부르지 않음
        # 우리 카운터보다 카카오 집계가 먼저 찼을 때 (같은 키로 한 개발 · 테스트 호출 등)
        _mark_multi_exhausted()
        raise
    try:
        routes = resp.json()["routes"]
        result: dict[str, TravelSummary | None] = {key: None for key in dests}
        for r in routes:
            key = r.get("key")
            # 보내지 않은 key는 무시함
            if key not in result:
                continue
            code = r.get("result_code")
            # 출발지와 충전소가 5m 이내 - 이미 충전소에 있음
            if code == KAKAO_SAME_PLACE_CODE:
                result[key] = TravelSummary(0, 0)
            # 성공한 곳만 시간 · 거리를 씀. 그 밖의 코드는 None으로 둬 그곳만 추정
            elif code == 0:
                summary = r["summary"]
                result[key] = TravelSummary(summary["duration"], summary["distance"])
        return result
    except (ValueError, KeyError, TypeError):
        logger.warning("다중 목적지 응답 형식이 예상과 다름")
        raise DirectionsUnavailable() from None
