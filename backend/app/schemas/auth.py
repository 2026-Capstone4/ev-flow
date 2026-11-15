from pydantic import Field

from app.schemas.base import CamelModel, KstDatetime


# 7번 로그인 요청 - 빈 값이면 422 VALIDATION_ERROR (프론트 문구: "아이디와 비밀번호를 입력해 주세요.")
class LoginRequest(CamelModel):
    login_id: str = Field(min_length=1, max_length=50)  # admin_users.login_id 길이
    # 본문 크기만 제한 - 비밀번호 정책(8자 이상)은 계정을 만들 때 create_admin.py가 검사
    password: str = Field(min_length=1, max_length=128)


class AdminInfo(CamelModel):
    login_id: str
    name: str


# 7번 로그인 · 9번 로그인 상태 응답 - 프론트 src/types/admin.ts의 AuthSession과 같아야 함
class AuthSession(CamelModel):
    admin: AdminInfo
    expires_at: KstDatetime  # 토큰 exp - KST 초 단위 (예: 2026-11-15T16:05:00+09:00)
