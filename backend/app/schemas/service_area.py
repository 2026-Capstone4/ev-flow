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
    # 대표 statId의 주소 · 좌표 - 네이버 지도 길안내 목적지
    address: str
    lat: float
    lng: float
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


# --- 전국 휴게소 (2026-11-24, 노선별 화면용) ---
# 위 휴게소 API(천안 대조군, 옛 앱)와 따로 둠 - 옛 앱은 direction(up · down)을 서울 · 부산 방향으로 고정해서 보여 줌
SeqOrder = Literal["asc", "desc"]


class NationwideServiceAreaSummary(CamelModel):
    # 노선이 붙은 곳은 표준데이터 휴게소명(예: 기흥(부산)), 못 붙인 곳은 statId - 충전기 현황 요청의 id
    id: str
    # 화면 이름 - 노선이 붙은 곳은 '음성휴게소 (남이 방향)'(표지판 방향), 못 붙인 곳은 충전소 이름에서 앞뒤 사업자 표기만 지운 것
    name: str
    # 방향을 뺀 이름 '음성휴게소' - 노선 화면(방향 탭)용. 못 붙인 곳은 name과 같음
    short_name: str
    # 노선을 못 붙인 곳(민자 노선 등)은 아래 노선 필드가 모두 null - 화면에서 실시간 상태만 보여 줌
    route_name: str | None
    route_no: str | None
    # 방향 버튼(노선 끝 도시). 양방향 휴게소 · 순환 노선은 null
    heading: str | None
    # 이름의 목적지 도시
    towards: str | None
    bidirectional: bool
    # 노선 안 순서 - heading 쪽으로 갈 때 seq_order가 asc면 커지고 desc면 작아짐
    route_seq: int | None
    seq_order: SeqOrder | None
    address: str | None
    # 노선이 붙은 곳은 표준데이터 휴게소 좌표, 못 붙인 곳은 충전소 좌표
    lat: float
    lng: float
    total_chargers: int
    available_chargers: int


class NationwideServiceArea(NationwideServiceAreaSummary):
    status_counts: StatusCounts
    data_quality: DataQuality


class NationwideServiceAreasResponse(CamelModel):
    updated_at: KstDatetime
    data_quality: ResponseDataQuality
    service_areas: list[NationwideServiceArea]


class NationwideServiceAreaChargersResponse(CamelModel):
    updated_at: KstDatetime
    data_quality: ResponseDataQuality
    service_area: NationwideServiceAreaSummary
    chargers: list[ServiceAreaChargerDetail]
