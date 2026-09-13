from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    ev_service_key: str  # data.go.kr 15076352 - getChargerStatus/getChargerInfo 공통
    target_sido: str = "서울특별시"
    target_gugun: str = "광진구"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
