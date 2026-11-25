import {
  useAdminChargersQuery,
  useCollectionStatusQuery,
  useMissingStatsQuery,
  useUtilizationQuery,
} from '@/hooks/useAdminQueries'
import { useNow } from '@ev-flow/core/hooks/useNow'
import {
  groupChargersByStation,
  sortChargers,
  sortStations,
  summarizeChargers,
  type ChargerSort,
  type StationSort,
} from '@/lib/admin/chargerStatus'
import { summarizeMissing } from '@/lib/admin/charts'
import { getCollectionHealth } from '@/lib/admin/collection'
import { getListLoadState } from '@ev-flow/core/lib/loadState'
import type { AdminRegion } from '@/types/admin'

/**
 * 운영 현황 화면 데이터. 화면(JSX)과 분리해 RN 전환 시 그대로 재사용.
 * 이용률 차트는 분석서(ADM-001)대로 오늘 시간대별 · 최근 4주 요일별을 항상 함께 보여 줌
 * 요약 카드의 데이터 수집 상태 · 결측 건수 · 결측률은 오늘 기준 (자세한 내용은 데이터 수집 화면)
 */
export function useAdminStatusData(
  region: AdminRegion,
  chargerSort: ChargerSort,
  stationSort: StationSort,
) {
  const now = useNow()
  const chargersQuery = useAdminChargersQuery(region)
  const hourlyQuery = useUtilizationQuery(region, 'day')
  const weeklyQuery = useUtilizationQuery(region, 'week')
  const collectionQuery = useCollectionStatusQuery(region)
  const missingQuery = useMissingStatsQuery(region, 'day')

  const chargers = chargersQuery.data?.chargers
  const targets = collectionQuery.data?.targets

  return {
    /** 충전기 목록 기준 시각 — 헤더의 갱신 상태 표시용 */
    updatedAt: chargersQuery.data ? new Date(chargersQuery.data.updatedAt) : null,
    isChargersError: chargersQuery.isError,
    chargersLoadState: getListLoadState(chargers, chargersQuery.isError),
    summary: chargers ? summarizeChargers(chargers) : null,
    sortedChargers: chargers ? sortChargers(chargers, chargerSort) : [],
    /** 충전소별 보기 — 충전기 목록을 충전소로 묶어 정렬 */
    sortedStations: chargers ? sortStations(groupChargersByStation(chargers), stationSort) : [],
    hourly: hourlyQuery.data,
    isHourlyError: hourlyQuery.isError,
    weekly: weeklyQuery.data,
    isWeeklyError: weeklyQuery.isError,
    collectionHealth: targets ? getCollectionHealth(targets, now) : null,
    /** 오늘 결측 합계 (선택한 지역 기준) */
    missingToday: missingQuery.data ? summarizeMissing(missingQuery.data.series) : null,
  }
}
