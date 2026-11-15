from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.config import settings
from app.db.session import get_db
from app.schemas.auth import AdminInfo, AuthSession, LoginRequest
from app.services import auth as auth_service
from app.services.auth import COOKIE_NAME, AdminSession

router = APIRouter(prefix="/auth", tags=["auth"])

# 쿠키 속성 - docs/api/admin.md 7번. Domain은 지정하지 않음 (Vite 개발 프록시를 거쳐도 저장되게)
COOKIE_OPTIONS = {
    "path": "/api",
    "httponly": True,
    "samesite": "strict",
    "secure": settings.auth_cookie_secure,
}


def to_response(session: AdminSession) -> AuthSession:
    admin = AdminInfo(login_id=session.admin.login_id, name=session.admin.name)
    return AuthSession(admin=admin, expires_at=session.expires_at)


@router.post("/login", response_model=AuthSession)
def login(body: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = auth_service.client_ip(request)
    session, token = auth_service.login(db, body.login_id, body.password, ip)
    response.set_cookie(
        COOKIE_NAME, token, max_age=settings.auth_token_ttl_minutes * 60, **COOKIE_OPTIONS
    )
    return to_response(session)


# 명세상 로그인 필요 (README 에러 표). JWT라 서버에 지울 세션이 없음 - 쿠키만 지우고 토큰은 exp까지 유효
@router.post(
    "/logout", status_code=204, response_class=Response, dependencies=[Depends(require_admin)]
)
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, **COOKIE_OPTIONS)


@router.get("/me", response_model=AuthSession)
def me(session: AdminSession = Depends(require_admin)):
    return to_response(session)
