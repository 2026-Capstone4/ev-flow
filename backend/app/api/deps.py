from fastapi import Cookie, Depends, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import get_db
from app.services import auth as auth_service
from app.services import rate_limit
from app.services.auth import COOKIE_NAME, AdminSession


# 운영자 API 공통 - 쿠키 토큰을 확인해 계정을 넘겨줌. 실패하면 401 UNAUTHORIZED (SER-004)
# /auth/logout · /auth/me와 이후 /admin/* 라우터가 Depends(require_admin)로 씀
def require_admin(
    token: str | None = Cookie(default=None, alias=COOKIE_NAME),
    db: Session = Depends(get_db),
) -> AdminSession:
    return auth_service.authenticate(db, token)


# 길찾기 호출 제한 - 라우터에서 dependencies=[Depends(limit_routes)]로 붙임. 추천도 scope만 바꿔 같은 방식
def limit_routes(request: Request) -> None:
    rate_limit.check("routes", auth_service.client_ip(request), settings.route_rate_limit_per_min)


# 추천 호출 제한 - 길찾기와 같은 한도(IP당 분당 10회), 횟수는 따로 셈 (2026-11-19 합의)
def limit_recommendations(request: Request) -> None:
    rate_limit.check(
        "recommendations", auth_service.client_ip(request), settings.route_rate_limit_per_min
    )
