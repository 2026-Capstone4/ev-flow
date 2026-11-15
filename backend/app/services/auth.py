import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
import redis
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.config import settings
from app.db.models import AdminUser

logger = logging.getLogger(__name__)

# argon2id, argon2-cffi 기본값(RFC 9106 저메모리 권장: 64MiB · 3회 · 병렬 4) - create_admin.py도 이 객체를 씀
password_hasher = PasswordHasher()
JWT_ALGORITHM = "HS256"
COOKIE_NAME = "evflow_admin_token"

# 로그인 실패 기록 - 실패 횟수 login_fail:{id|ip}:{값}(창 동안 유지), 잠금 login_lock:{id|ip}:{값}
# 장애 시 제한 없이 진행하므로 짧게 끊음
_redis = redis.Redis.from_url(settings.redis_url, socket_timeout=2, socket_connect_timeout=2)
_dummy_hash: str | None = None


def unauthorized() -> ApiError:
    return ApiError(401, "UNAUTHORIZED", "로그인이 필요합니다.")


@dataclass
class AdminSession:
    admin: AdminUser
    expires_at: datetime  # 토큰 exp


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(admin: AdminUser | None, password: str) -> bool:
    """계정이 없어도 같은 비용으로 검증 - 응답 시간으로 아이디 존재 여부가 드러나지 않게 함"""
    global _dummy_hash
    if admin is None:
        _dummy_hash = _dummy_hash or password_hasher.hash("timing-equalizer")
    try:
        password_hasher.verify(admin.password_hash if admin else _dummy_hash, password)
    except (VerificationError, InvalidHashError):
        return False
    return admin is not None


def _jwt_secret() -> str:
    secret = settings.jwt_secret.get_secret_value()
    if not secret:
        logger.error("JWT_SECRET이 비어 있어 운영자 로그인을 처리할 수 없음 - .env.example 참고")
        raise ApiError(500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.")
    return secret


def issue_token(admin: AdminUser, now: datetime) -> tuple[str, datetime]:
    # iat · exp는 초 단위 - 응답 expiresAt도 exp와 똑같이 맞춤
    issued_at = now.replace(microsecond=0)
    expires_at = issued_at + timedelta(minutes=settings.auth_token_ttl_minutes)
    claims = {
        "sub": str(admin.id),
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    return jwt.encode(claims, _jwt_secret(), algorithm=JWT_ALGORITHM), expires_at


def authenticate(db: Session, token: str | None) -> AdminSession:
    """쿠키 토큰 → 계정. 없음 · 위조 · 만료 · 삭제된 계정 · 비밀번호 변경 전 토큰 모두 401 하나로 응답"""
    if not token:
        raise unauthorized()
    try:
        claims = jwt.decode(
            token,
            _jwt_secret(),
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "iat", "exp"]},
        )
        admin_id = int(claims["sub"])
    except (jwt.InvalidTokenError, ValueError):
        raise unauthorized() from None
    admin = db.get(AdminUser, admin_id)
    # iat가 초 단위라 DB 시각도 초 미만을 버리고 비교 - 버리지 않으면 변경 직후 같은 초에 받은 토큰까지 거부됨
    if admin is None or claims["iat"] < int(admin.password_changed_at.timestamp()):
        raise unauthorized()
    return AdminSession(admin, datetime.fromtimestamp(claims["exp"], UTC))


def client_ip(request: Request) -> str:
    # 서버: nginx가 X-Real-IP를 실제 접속 주소로 덮어씀. api 컨테이너는 외부 포트가 없어 위조할 수 없음
    # 로컬: nginx 없이 직접 호출하므로 연결 주소
    return request.headers.get("x-real-ip") or (
        request.client.host if request.client else "unknown"
    )


def _limits(login_id: str, ip: str) -> list[tuple[str, int]]:
    return [
        (f"id:{login_id}", settings.login_max_failures_per_id),
        (f"ip:{ip}", settings.login_max_failures_per_ip),
    ]


def lock_remaining_seconds(login_id: str, ip: str) -> int:
    """아이디나 IP가 잠겨 있으면 남은 초(긴 쪽), 아니면 0"""
    try:
        pipe = _redis.pipeline()
        for target, _ in _limits(login_id, ip):
            pipe.ttl(f"login_lock:{target}")
        ttls = pipe.execute()
    except redis.RedisError:
        logger.warning("Redis 오류 - 로그인 잠금 확인 없이 진행", exc_info=True)
        return 0
    return max((ttl for ttl in ttls if ttl > 0), default=0)


def record_failure(login_id: str, ip: str) -> None:
    """실패 횟수를 올리고, 한도에 닿으면 잠금을 걸고 횟수를 0부터 다시 셈"""
    try:
        pipe = _redis.pipeline()
        for target, _ in _limits(login_id, ip):
            pipe.incr(f"login_fail:{target}")
            pipe.expire(f"login_fail:{target}", settings.login_failure_window_seconds, nx=True)
        counts = pipe.execute()[0::2]

        pipe = _redis.pipeline()
        for (target, limit), count in zip(_limits(login_id, ip), counts, strict=True):
            if count >= limit:
                pipe.set(f"login_lock:{target}", 1, ex=settings.login_lock_seconds)
                pipe.delete(f"login_fail:{target}")
        pipe.execute()
    except redis.RedisError:
        logger.warning("Redis 오류 - 로그인 실패를 기록하지 못함", exc_info=True)


def clear_failures(login_id: str) -> None:
    # 아이디 기록만 지움 - IP 기록은 여러 아이디를 돌려 대입하는 걸 막는 용도라 남겨 둠
    try:
        _redis.delete(f"login_fail:id:{login_id}")
    except redis.RedisError:
        logger.warning("Redis 오류 - 로그인 실패 기록을 지우지 못함", exc_info=True)


def login(db: Session, login_id: str, password: str, ip: str) -> tuple[AdminSession, str]:
    _jwt_secret()  # 설정이 빠졌으면 실패 횟수를 올리기 전에 500
    remaining = lock_remaining_seconds(login_id, ip)
    if remaining:
        raise ApiError(
            429,
            "LOGIN_LOCKED",
            "로그인 시도가 많아 잠시 후 다시 시도해 주세요.",
            headers={"Retry-After": str(remaining)},
        )

    admin = db.scalar(select(AdminUser).where(AdminUser.login_id == login_id))
    if not verify_password(admin, password):
        record_failure(login_id, ip)
        raise ApiError(401, "INVALID_CREDENTIALS", "아이디 또는 비밀번호가 올바르지 않습니다.")

    clear_failures(login_id)
    now = datetime.now(UTC)
    # argon2 설정값을 올렸으면 다음 로그인 때 새 설정으로 다시 해시 - password_changed_at은 그대로(로그인 유지)
    if password_hasher.check_needs_rehash(admin.password_hash):
        admin.password_hash = hash_password(password)
    admin.last_login_at = now
    token, expires_at = issue_token(admin, now)
    db.commit()
    return AdminSession(admin, expires_at), token
