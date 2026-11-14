import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  fetchAdminChargers,
  fetchCollectionStatus,
  fetchImputedCount,
  fetchMissingStats,
  fetchUtilization,
} from '@/api/admin'
import { ADMIN_QUERY_KEY } from '@/hooks/useAdminAuth'
import type { AdminPeriod, AdminRegion } from '@/types/admin'

// 폴링 · 캐시 설정은 queryClient 기본값 사용
// 지역 · 기간을 바꾸는 동안 이전 값을 그대로 보여 줘서 차트 · 표가 깜빡이지 않게 함 (keepPreviousData)

export function useUtilizationQuery(region: AdminRegion, period: AdminPeriod) {
  return useQuery({
    queryKey: [...ADMIN_QUERY_KEY, 'utilization', region, period],
    queryFn: () => fetchUtilization(region, period),
    placeholderData: keepPreviousData,
  })
}

export function useAdminChargersQuery(region: AdminRegion) {
  return useQuery({
    queryKey: [...ADMIN_QUERY_KEY, 'chargers', region],
    queryFn: () => fetchAdminChargers(region),
    placeholderData: keepPreviousData,
  })
}

export function useCollectionStatusQuery(region: AdminRegion) {
  return useQuery({
    queryKey: [...ADMIN_QUERY_KEY, 'collection-status', region],
    queryFn: () => fetchCollectionStatus(region),
    placeholderData: keepPreviousData,
  })
}

export function useMissingStatsQuery(region: AdminRegion, period: AdminPeriod) {
  return useQuery({
    queryKey: [...ADMIN_QUERY_KEY, 'missing-stats', region, period],
    queryFn: () => fetchMissingStats(region, period),
    placeholderData: keepPreviousData,
  })
}

export function useImputedCountQuery(period: AdminPeriod) {
  return useQuery({
    queryKey: [...ADMIN_QUERY_KEY, 'imputed-count', period],
    queryFn: () => fetchImputedCount(period),
    placeholderData: keepPreviousData,
  })
}
