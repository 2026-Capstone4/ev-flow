from typing import Literal

from pydantic import Field

from app.schemas.base import CamelModel


class Origin(CamelModel):
    # 한국 범위 밖이면 422 VALIDATION_ERROR - 엉뚱한 좌표로 Directions 하루 예산을 쓰지 않게 함
    lat: float = Field(ge=33, le=39)
    lng: float = Field(ge=124, le=132)


class RouteRequest(CamelModel):
    origin: Origin
    station_id: str = Field(min_length=1, max_length=32)


class RouteResponse(CamelModel):
    station_id: str
    travel_time_minutes: int
    distance_meters: int
    # [위도, 경도] 배열 - Directions 원본([경도, 위도])에서 순서를 바꿔 보냄
    path: list[tuple[float, float]]
    # 경로를 만든 길찾기 제공자 - 화면에 출처("경로 정보: 카카오모빌리티")를 표시할 때 씀
    provider: Literal["kakao", "naver"]
