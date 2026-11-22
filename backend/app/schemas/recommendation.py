from typing import Literal

from pydantic import Field

from app.schemas.base import CamelModel, KstDatetime
from app.schemas.common import ConnectorType, ResponseDataQuality

# 추천 탭 (REC-006) - 0은 지금 출발, 15 · 30은 h분 후 도착. 순위는 AI 추천 모듈 채점 그대로 (2026-11-22)
RecommendHorizon = Literal[0, 15, 30]


class RecommendationFilters(CamelModel):
    """화면 필터 그대로 (REC-004) - 판정은 docs/api/README.md 필터 판정 규칙, 지도 필터와 같음"""

    connector_types: list[ConnectorType] = []  # 빈 배열이면 전체
    min_capacity_kw: int | None = None  # 100 · 200, null이면 전체
    status_filter: Literal["all", "available_only", "exclude_high"] = "all"


class RecommendationRequest(CamelModel):
    # 한국 범위 밖이면 422 VALIDATION_ERROR (길찾기와 같음). 마포구 밖은 서비스에서 422 OUT_OF_SERVICE_AREA
    lat: float = Field(ge=33, le=39)
    lng: float = Field(ge=124, le=132)
    filters: RecommendationFilters = RecommendationFilters()


class RecommendedStation(CamelModel):
    station_id: str
    name: str
    lat: float
    lng: float
    total_chargers: int
    available_chargers: int  # 현재 사용 가능 대수 (REC-002)


class Recommendation(CamelModel):
    rank: int
    station: RecommendedStation
    # 추천 근거 (AI 추천 모듈 단계) - forecast: 모델 예측(공식 추천) / recent_observation: 최근 15분 관측(참고 안내)
    basis: Literal["forecast", "recent_observation"]
    # forecast는 AI가 고른 예측 시점의 혼잡도, recent_observation은 현재 혼잡도 (확인 비율이 모자라면 null)
    congestion: Literal["low", "medium", "high"] | None
    # forecast일 때만 값. 대기 표시를 끈 동안(SHOW_WAIT_PREDICTION)은 null
    wait_time_p50_minutes: int | None
    wait_time_p90_minutes: int | None
    source: Literal["model"] | None  # forecast면 model, recent_observation이면 null
    travel_time_minutes: int
    distance_meters: int
    travel_time_source: Literal["directions", "estimate"]
    reason: str  # 가장 가까운 후보와 비교한 문구 (REC-003)


class HorizonRecommendations(CamelModel):
    horizon_minutes: RecommendHorizon
    recommendations: list[Recommendation]  # 최대 3개, 후보가 모자라면 짧거나 빈 배열


class RecommendationsResponse(CamelModel):
    updated_at: KstDatetime
    data_quality: ResponseDataQuality
    results: list[HorizonRecommendations]  # 0 · 15 · 30 순서
