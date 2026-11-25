import { useCollectionStatusQuery, useMissingStatsQuery } from '@/hooks/useAdminQueries'
import { useNow } from '@ev-flow/core/hooks/useNow'
import { getTargetHealth } from '@/lib/admin/collection'
import type { AdminPeriod, AdminRegion } from '@/types/admin'

/**
 * 데이터 수집 화면 데이터. 화면(JSX)과 분리해 RN 전환 시 그대로 재사용.
 * 기간(period)은 결측 현황에만 씀 (수집 상태는 늘 최근 실행 기준)
 */
export function useAdminCollectionData(region: AdminRegion, period: AdminPeriod) {
  const now = useNow()
  const collectionQuery = useCollectionStatusQuery(region)
  const missingQuery = useMissingStatsQuery(region, period)

  return {
    now,
    /** 수집 상태를 마지막으로 받은 시각 — 헤더의 갱신 상태 표시용. 이 응답엔 기준 시각이 없어 받은 시각을 씀 */
    updatedAt: collectionQuery.dataUpdatedAt ? new Date(collectionQuery.dataUpdatedAt) : null,
    /** 둘 중 하나라도 다시 불러오기에 실패했는지 */
    isAnyError: collectionQuery.isError || missingQuery.isError,
    /** 지역을 바꾼 뒤 새 응답을 기다리며 이전 지역 값을 보여 주는 중인지 */
    isTargetsStale: collectionQuery.isPlaceholderData,
    /** 지역 · 기간을 바꾼 뒤 새 응답을 기다리며 이전 값을 보여 주는 중인지 */
    isMissingStale: missingQuery.isPlaceholderData,
    /** 수집 대상별 상태 (도심 · 휴게소) */
    targets: collectionQuery.data?.targets.map((target) => ({
      ...target,
      health: getTargetHealth(target, now),
    })),
    isCollectionError: collectionQuery.isError,
    missing: missingQuery.data,
    isMissingError: missingQuery.isError,
  }
}
