// 운영자 API 명세(docs/api/admin.md 7~14번) 기준. 응답 필드 이름을 바꾸지 않고 그대로 씀 (API-05)
import type { ChargerStatus } from '@ev-flow/core/types/station'

/** 조회 지역. seoul = city(마포구) + live(마포구를 뺀 서울), all = city · live · service_area 모두 */
export type AdminRegion = 'all' | 'seoul' | 'city' | 'service_area'

/** 수집 대상 — 충전기 목록의 region · 수집 상태의 target. live = 마포구를 뺀 서울 */
export type CollectionTargetName = 'city' | 'live' | 'service_area'

/** 대시보드 집계 기간. day = 오늘, week = 이용률은 최근 4주 · 결측은 최근 7일 */
export type AdminPeriod = 'day' | 'week'

export type LoginRequest = {
  loginId: string
  password: string
}

/** 로그인(7번) · 로그인 상태(9번) 응답 */
export type AuthSession = {
  admin: { loginId: string; name: string }
  /** 로그인 만료 시각 */
  expiresAt: string
}

/** 이용률 차트 한 칸 (시간대 또는 요일) */
export type UtilizationBucket = {
  /** day: 0~23시 · week: 0 = 월요일 ~ 6 = 일요일 */
  bucket: number
  label: string
  /** 0~1. 관측이 없으면 null (아직 오지 않은 시간 포함) */
  occupancyRate: number | null
  observationCount: number
}

export type UtilizationResponse = {
  region: AdminRegion
  /** 서울 구 코드 · 휴게소 시도 코드. 구 · 시도를 골라 요청했을 때만 */
  district: string | null
  period: AdminPeriod
  from: string
  to: string
  averageOccupancyRate: number | null
  series: UtilizationBucket[]
}

export type AdminCharger = {
  region: CollectionTargetName
  stationId: string
  /** 도심 · 서울은 충전소명, 휴게소는 휴게소명 */
  stationName: string
  /** 도심은 서울 구 코드 · 이름 (예: 11680 · 강남구), 휴게소는 시도 (예: 41 · 경기도). 모르는 충전소는 null */
  district: string | null
  districtName: string | null
  chargerId: string
  status: ChargerStatus
  /** API 원본 상태 코드 — 통신이상(1) · 상태미확인(9) 구분용. 마지막 성공 수집에 그 충전기가 없으면 null */
  stat: string | null
  /** 원천 데이터 문제로 2↔9를 반복하는 충전기인지 (백엔드 status.py 목록, 사용자 API와 같은 기준) */
  unstable: boolean
  todayOccupancyRate: number | null
  /** API의 상태 갱신 시각 (참고용) */
  statUpdatedAt: string | null
}

export type AdminChargersResponse = {
  updatedAt: string
  chargers: AdminCharger[]
}

export type CollectionRunStatus = 'running' | 'success' | 'partial' | 'failed'

export type CollectionTarget = {
  target: CollectionTargetName
  zscode: string
  lastRunAt: string | null
  lastStatus: CollectionRunStatus | null
  lastSuccessAt: string | null
  /** 오늘 failed · partial 실행 수 */
  failedRunsToday: number
  lastApiLatencyMs: number | null
  averageApiLatencyMsToday: number | null
}

export type CollectionStatusResponse = {
  targets: CollectionTarget[]
}

export type MissingBucket = {
  /** day: 0~23(시) · week: 'YYYY-MM-DD' */
  bucket: number | string
  label: string
  expectedCount: number
  matchedCount: number
  missingCount: number
  /** 실행이 없으면 null */
  missingRate: number | null
  failedRuns: number
}

export type MissingStatsResponse = {
  region: AdminRegion
  period: AdminPeriod
  from: string
  to: string
  series: MissingBucket[]
}
