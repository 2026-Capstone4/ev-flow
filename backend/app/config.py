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


settings = Settings()
