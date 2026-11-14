import {
  useAdminChargersQuery,
  useCollectionStatusQuery,
  useImputedCountQuery,
  useMissingStatsQuery,
  useUtilizationQuery,
} from '@/hooks/useAdminQueries'
import { useNow } from '@/hooks/useNow'
import {
  getCollectionHealth,
  getTargetHealth,
  sortChargers,
  summarizeChargers,
  type ChargerSort,
} from '@/lib/admin'
import { getListLoadState } from '@/lib/loadState'
import type { AdminPeriod, AdminRegion } from '@/types/admin'

/**
 * 운영자 대시보드 화면 데이터. 화면(JSX)과 분리해 RN 전환 시 그대로 재사용.
 * 이용률 차트는 분석서(ADM-001)대로 오늘 시간대별 · 최근 4주 요일별을 항상 함께 보여 주고,
 * 기간(period)은 결측 현황 · 결측 대체 건수에만 씀
 */
export function useAdminDashboardData(region: AdminRegion, period: AdminPeriod, sort: ChargerSort) {
  const now = useNow()
  const chargersQuery = useAdminChargersQuery(region)
  const hourlyQuery = useUtilizationQuery(region, 'day')
  const weeklyQuery = useUtilizationQuery(region, 'week')
  const collectionQuery = useCollectionStatusQuery(region)
  const missingQuery = useMissingStatsQuery(region, period)
  const imputedQuery = useImputedCountQuery(period)

  const chargers = chargersQuery.data?.chargers
  const targets = collectionQuery.data?.targets

  return {
    now,
    /** 충전기 목록 기준 시각 — 헤더의 갱신 상태 표시용 */
    updatedAt: chargersQuery.data ? new Date(chargersQuery.data.updatedAt) : null,
    isChargersError: chargersQuery.isError,
    chargersLoadState: getListLoadState(chargers, chargersQuery.isError),
    summary: chargers ? summarizeChargers(chargers) : null,
    sortedChargers: chargers ? sortChargers(chargers, sort) : [],
    hourly: hourlyQuery.data,
    isHourlyError: hourlyQuery.isError,
    weekly: weeklyQuery.data,
    isWeeklyError: weeklyQuery.isError,
    collectionHealth: targets ? getCollectionHealth(targets, now) : null,
    /** 수집 대상별 상태 (도심 · 휴게소) */
    targets: targets?.map((target) => ({ ...target, health: getTargetHealth(target, now) })),
    isCollectionError: collectionQuery.isError,
    missing: missingQuery.data,
    isMissingError: missingQuery.isError,
    imputed: imputedQuery.data,
    isImputedError: imputedQuery.isError,
  }
}
