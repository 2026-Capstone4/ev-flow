from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # extra: .env에 있는 Compose 전용 변수(POSTGRES_*)를 무시함 - forbid면 호스트 실행이 전부 실패함
    # hide_input_in_errors: 검증 실패 메시지에 입력값을 넣지 않음 - 비밀값 평문 노출 차단
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    # SecretStr - 설정 객체를 통째로 출력해도 마스킹됨, 실제 값은 get_secret_value()로 꺼냄
    database_url: SecretStr
    ev_service_key: SecretStr  # data.go.kr 15076352 - getChargerStatus/getChargerInfo 공통
    # 기본값은 호스트에서 직접 실행할 때(override 포트) 기준 - 컨테이너 안에서는 compose가 덮어씀
    redis_url: str = "redis://localhost:6379/0"
    ml_url: str = "http://localhost:8001"
    # 체크포인트 producer - 비어 있으면 collector가 체크포인트 갱신을 건너뜀 (producer 없이 로컬 실행할 때)
    producer_url: str = ""

    # 네이버 Directions 5 - 추천 · 경로 API에서 사용. 기본값 빈 값: 키가 없어도 api · collector가 뜨게 함
    naver_client_id: str = ""
    naver_client_secret: SecretStr = SecretStr("")
    # 길찾기 · 추천 호출 제한 (SER-003, MAP-02) - 시연 날 강의실처럼 한 공인 IP를 여럿이 쓰면 .env에서 올림
    route_rate_limit_per_min: int = 10
    directions_daily_limit: int = 2000  # 서버 전체 Directions 실제 호출 수 / 하루(KST)

    # 운영자 로그인 (SER-001) - 토큰은 JWT(HS256)를 HttpOnly 쿠키로 내려줌
    # 비어 있으면 로그인만 500으로 막고 api · collector는 그대로 뜸 - 값은 .env.example 안내대로 생성
    jwt_secret: SecretStr = SecretStr("")
    auth_token_ttl_minutes: int = 120  # 연장 없음 - 만료되면 다시 로그인
    # HTTPS 운영 기준 기본 켬. 로컬 http에서 쿠키가 저장되지 않으면 .env에 false
    auth_cookie_secure: bool = True
    # 로그인 실패 제한 - 창(window) 안에 한도만큼 틀리면 잠금. IP는 시연자 IP까지 막히지 않게 넉넉히
    login_max_failures_per_id: int = 5
    login_max_failures_per_ip: int = 20
    login_failure_window_seconds: int = 900
    login_lock_seconds: int = 900


settings = Settings()
