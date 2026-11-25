from typing import Literal

from pydantic import Field

from app.schemas.base import CamelModel, KstDatetime
from app.schemas.common import ChargerStatus

# 값 목록은 docs/api/admin.md - 프론트 src/types/admin.ts와 같아야 함
# seoul = city(마포) + live(마포를 뺀 서울), all = 셋 모두 (2026-11-25 서울 추가)
AdminRegion = Literal["all", "seoul", "city", "service_area"]
AdminPeriod = Literal["day", "week"]  # day = 오늘 · week = 이용률 최근 4주, 결측 최근 7일
CollectionTargetName = Literal["city", "live", "service_area"]
CollectionRunStatus = Literal["running", "success", "partial", "failed"]


class PeriodRange(CamelModel):
    # from은 파이썬 예약어라 필드 이름은 from_, JSON 이름만 from
    from_: KstDatetime = Field(alias="from")
    to: KstDatetime


# 10번 이용률 - 관측 = 수집 성공 회차의 상태 로그 1행
class UtilizationBucket(CamelModel):
    bucket: int  # day: 0~23시 · week: 0 = 월요일 ~ 6 = 일요일
    label: str
    occupancy_rate: float | None  # 충전 중 ÷ (사용 가능 + 충전 중). 관측이 없으면 null
    observation_count: int  # 분모에 들어간 관측 수


class UtilizationResponse(PeriodRange):
    region: AdminRegion
    period: AdminPeriod
    average_occupancy_rate: float | None  # 기간 전체 관측을 합친 비율 (칸별 평균이 아님)
    series: list[UtilizationBucket]


# 11번 충전기 목록
class AdminCharger(CamelModel):
    region: CollectionTargetName
    station_id: str
    station_name: str  # 도심 · 서울은 충전소명, 휴게소는 휴게소명
    charger_id: str
    status: ChargerStatus
    stat: str | None  # API 원본 상태 코드. 마지막 성공 회차에 행이 없으면 null
    unstable: bool  # 원천 데이터 문제로 2↔9를 반복하는 충전기 (사용자 API와 같은 기준)
    today_occupancy_rate: float | None
    stat_updated_at: KstDatetime | None  # API statUpdDt - 운영사마다 갱신 방식이 달라 참고용


class AdminChargersResponse(CamelModel):
    updated_at: KstDatetime  # 대상별 마지막 성공 수집 시각 중 오래된 쪽
    chargers: list[AdminCharger]


# 12번 수집 상태
class CollectionTarget(CamelModel):
    target: CollectionTargetName
    zscode: str
    last_run_at: KstDatetime | None
    last_status: CollectionRunStatus | None
    last_success_at: KstDatetime | None  # SUCCESS만 (PARTIAL 제외)
    failed_runs_today: int  # 오늘 FAILED · PARTIAL 실행 수
    last_api_latency_ms: int | None
    average_api_latency_ms_today: int | None


class CollectionStatusResponse(CamelModel):
    targets: list[CollectionTarget]


# 13번 결측 현황 - collection_runs만 집계, RUNNING 회차는 뺌
class MissingBucket(CamelModel):
    bucket: int | str  # day: 0~23(시) · week: 'YYYY-MM-DD'
    label: str
    expected_count: int
    matched_count: int
    missing_count: int
    missing_rate: float | None  # 실행이 없으면 null
    failed_runs: int  # FAILED 실행 수 (PARTIAL은 대부분 Info 보정 실패라 제외)


class MissingStatsResponse(PeriodRange):
    region: AdminRegion
    period: AdminPeriod
    series: list[MissingBucket]
