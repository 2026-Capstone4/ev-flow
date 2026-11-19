"""사용자 API 호출 제한 (SER-003) - IP별 60초 고정 창, 넘으면 429 RATE_LIMITED + Retry-After

로그인 잠금(auth.py)과 같은 방식: rate:{scope}:{ip}에 INCR, 처음 한 번만 EXPIRE 60.
Nginx limit_req는 쓰지 않음 - 우리 에러 형식(error.code) · Retry-After가 붙지 않아 프론트가 네트워크 오류로 처리함
Redis 장애 시 제한 없이 진행
"""

import logging

import redis

from app.api.errors import ApiError
from app.config import settings

logger = logging.getLogger(__name__)

WINDOW_SEC = 60

_redis = redis.Redis.from_url(settings.redis_url, socket_timeout=1, socket_connect_timeout=1)


def check(scope: str, ip: str, limit_per_min: int) -> None:
    """이번 요청을 세고, 창 안에서 한도를 넘었으면 429. scope는 엔드포인트 이름(routes · recommendations)"""
    key = f"rate:{scope}:{ip}"
    try:
        pipe = _redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, WINDOW_SEC, nx=True)
        pipe.ttl(key)
        count, _, ttl = pipe.execute()
    except redis.RedisError:
        logger.warning("Redis 오류 - 호출 제한 확인 없이 진행")
        return
    if count > limit_per_min:
        raise ApiError(
            429,
            "RATE_LIMITED",
            "요청이 많아 잠시 후 다시 시도해 주세요.",
            headers={"Retry-After": str(max(ttl, 1))},
        )
