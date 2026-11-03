import type { Charger, RecommendationFilters, Station } from '@/types/station'

// 지도 필터(프론트)와 추천 후보(서버)가 같은 규칙을 씀 — docs/api/README.md "필터 판정 규칙"

export const DEFAULT_FILTERS: RecommendationFilters = {
  connectorTypes: [],
  minCapacityKw: null,
  statusFilter: 'all',
}

/** 적용 중인 조건 수 (커넥터는 고른 개수만큼) */
export function countActiveFilters(filters: RecommendationFilters) {
  return (
    filters.connectorTypes.length +
    (filters.minCapacityKw === null ? 0 : 1) +
    (filters.statusFilter === 'all' ? 0 : 1)
  )
}

export function isDefaultFilters(filters: RecommendationFilters) {
  return countActiveFilters(filters) === 0
}

/** 커넥터 · 용량 · (사용 가능만이면) 상태를 충전기 하나가 모두 만족해야 함 */
function matchesCharger(charger: Charger, filters: RecommendationFilters) {
  const { connectorTypes, minCapacityKw, statusFilter } = filters
  return (
    (connectorTypes.length === 0 ||
      charger.connectorTypes.some((type) => connectorTypes.includes(type))) &&
    (minCapacityKw === null || charger.capacityKw >= minCapacityKw) &&
    (statusFilter !== 'available_only' || charger.status === 'available')
  )
}

export function matchesFilters(station: Station, filters: RecommendationFilters) {
  // 혼잡 제외는 현재 혼잡도 기준. 확인 불가(unknown)는 남김
  if (
    filters.statusFilter === 'exclude_high' &&
    (station.congestion === 'high' || station.congestion === 'unavailable')
  ) {
    return false
  }
  return station.chargers.some((charger) => matchesCharger(charger, filters))
}
