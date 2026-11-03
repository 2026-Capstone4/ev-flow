from typing import Literal

from app.schemas.base import CamelModel, KstDatetime

# 값 목록은 docs/api/README.md 공통 값 - 프론트 src/types/station.ts와 같아야 함
ChargerStatus = Literal["available", "charging", "stopped", "maintenance", "unknown"]
ConnectorType = Literal["dc_chademo", "ac3", "dc_combo", "nacs"]
CurrentCongestion = Literal["low", "medium", "high", "unknown", "unavailable"]
DataQuality = Literal["normal", "missing", "delayed", "baseline"]
# 응답 최상위 값은 경과 시간만 반영해 missing이 나오지 않음
ResponseDataQuality = Literal["normal", "delayed", "baseline"]


class Charger(CamelModel):
    charger_id: str
    status: ChargerStatus
    connector_types: list[ConnectorType]
    capacity_kw: int | float


class ChargerDetail(Charger):
    # 충전 중이 아니면 null - 경과 시간은 프론트에서 계산 (STN-003)
    charging_started_at: KstDatetime | None
