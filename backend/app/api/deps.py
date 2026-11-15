from fastapi import Cookie, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services import auth as auth_service
from app.services.auth import COOKIE_NAME, AdminSession


# 운영자 API 공통 - 쿠키 토큰을 확인해 계정을 넘겨줌. 실패하면 401 UNAUTHORIZED (SER-004)
# /auth/logout · /auth/me와 이후 /admin/* 라우터가 Depends(require_admin)로 씀
def require_admin(
    token: str | None = Cookie(default=None, alias=COOKIE_NAME),
    db: Session = Depends(get_db),
) -> AdminSession:
    return auth_service.authenticate(db, token)
