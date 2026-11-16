from typing import Literal

from app.schemas.base import CamelModel, KstDatetime
from app.schemas.common import (
    Charger,
    ChargerDetail,
    CurrentCongestion,
    DataQuality,
    ResponseDataQuality,
)


class Prediction(CamelModel):
    horizon_minutes: Literal[15, 30, 60]
    # 예측 · 기준선이 모두 없으면 null (UC-U05 E2)
    congestion: Literal["low", "medium", "high"] | None
    wait_time_p50_minutes: int | None
    wait_time_p90_minutes: int | None
    source: Literal["model", "baseline"] | None


class Station(CamelModel):
    station_id: str
    name: str
    address: str
    lat: float
    lng: float
    operator: str
    total_chargers: int
    available_chargers: int
    slow_charger_count: int
    mid_charger_count: int
    # 현재 혼잡도 - 지도 마커는 예측 시점과 상관없이 항상 이 값 (REC-006)
    congestion: CurrentCongestion
    data_quality: DataQuality
    # 마포만 true. 서울(마포 제외)은 실시간 상태만 있고 predictions는 형식만 유지(값 전부 null) - 서울 확대 설계
    prediction_available: bool
    chargers: list[Charger]
    predictions: list[Prediction]


class StationDetail(Station):
    chargers: list[ChargerDetail]


class StationsResponse(CamelModel):
    updated_at: KstDatetime
    data_quality: ResponseDataQuality
    stations: list[Station]


class StationDetailResponse(CamelModel):
    updated_at: KstDatetime
    data_quality: ResponseDataQuality
    station: StationDetail
