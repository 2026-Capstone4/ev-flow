from typing import Literal

from app.schemas.base import CamelModel, KstDatetime
from app.schemas.common import ChargerDetail, DataQuality, ResponseDataQuality

# up = 상행(서울 방향) · down = 하행(부산 방향). DB에는 한글로 저장돼 있음
Direction = Literal["up", "down"]


class StatusCounts(CamelModel):
    available: int
    charging: int
    stopped: int
    maintenance: int
    unknown: int


class ServiceAreaSummary(CamelModel):
    name: str
    route: str
    direction: Direction
    total_chargers: int
    available_chargers: int


class ServiceArea(ServiceAreaSummary):
    status_counts: StatusCounts
    data_quality: DataQuality


class ServiceAreasResponse(CamelModel):
    updated_at: KstDatetime
    data_quality: ResponseDataQuality
    service_areas: list[ServiceArea]


# 한 휴게소에 운영기관이 여럿이라 충전기마다 충전소 · 운영기관을 붙임
class ServiceAreaChargerDetail(ChargerDetail):
    station_id: str
    operator: str


class ServiceAreaChargersResponse(CamelModel):
    updated_at: KstDatetime
    data_quality: ResponseDataQuality
    service_area: ServiceAreaSummary
    chargers: list[ServiceAreaChargerDetail]
