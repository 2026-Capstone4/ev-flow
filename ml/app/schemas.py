"""collector ↔ ml 요청 · 응답 형식 - docs/prediction.md (🟡 초안, 입력 형식은 AI-03 결정 후 수정)"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Horizon = Literal[15, 30, 60]
Congestion = Literal["low", "medium", "high"]


class StatusRow(BaseModel):
    """상태 로그 한 행 (city_status_log)"""

    station_id: str
    charger_id: str
    collected_at: datetime
    stat: str | None


class PredictRequest(BaseModel):
    # 예측 기준 시각 = 입력으로 쓴 수집 회차의 started_at (UTC)
    base_time: datetime
    # 🟡 최근 몇 시간치를 보낼지는 AI 팀 피처 코드에 따라 정함 (AI-03). 버스전용 충전기는 collector가 빼고 보냄
    rows: list[StatusRow]


class HorizonPrediction(BaseModel):
    horizon: Horizon
    congestion: Congestion
    wait_p50: float = Field(ge=0)
    wait_p90: float = Field(ge=0)


class PredictResponse(BaseModel):
    model_version: str
    # 충전소 ID → 15 · 30 · 60분 순서로 3개
    stations: dict[str, list[HorizonPrediction]]
