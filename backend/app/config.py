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
    target_sido: str = "서울특별시"
    target_gugun: str = "광진구"


settings = Settings()
