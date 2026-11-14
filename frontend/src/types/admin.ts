// 운영자 API 명세(docs/api/admin.md 7~14번) 기준. 응답 필드 이름을 바꾸지 않고 그대로 씀 (API-05)
import type { ChargerStatus } from '@/types/station'

export type AdminRegion = 'all' | 'city' | 'service_area'

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
  period: AdminPeriod
  from: string
  to: string
  averageOccupancyRate: number | null
  series: UtilizationBucket[]
}

export type AdminCharger = {
  region: Exclude<AdminRegion, 'all'>
  stationId: string
  /** 도심은 충전소명, 휴게소는 휴게소명 */
  stationName: string
  chargerId: string
  status: ChargerStatus
  /** API 원본 상태 코드 — 통신이상(1) · 상태미확인(9) 구분용 */
  stat: string
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
  target: Exclude<AdminRegion, 'all'>
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

export type ImputedCountResponse = {
  period: AdminPeriod
  from: string
  to: string
  imputedCount: number
  totalCount: number
}
