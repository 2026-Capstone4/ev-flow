import { keepPreviousData, queryOptions, useQuery, type QueryClient } from '@tanstack/react-query'
import {
  fetchAdminChargers,
  fetchCollectionStatus,
  fetchMissingStats,
  fetchUtilization,
} from '@/api/admin'
import { ADMIN_QUERY_KEY } from '@/hooks/useAdminAuth'
import { DEFAULT_ADMIN_REGION } from '@/lib/admin/common'
import type { AdminPeriod, AdminRegion } from '@/types/admin'

// 폴링 · 캐시 설정은 queryClient 기본값 사용
// 지역 · 기간을 바꾸는 동안 이전 값을 그대로 보여 줘서 차트 · 표가 깜빡이지 않게 함 (keepPreviousData)
// district는 서울 구 코드 · 휴게소 시도 코드 — 고르지 않았으면 undefined (toDistrictParam)
// 쿼리 설정을 함수로 둬서 화면(useQuery)과 미리 불러오기(prefetchQuery)가 같은 키를 씀

const utilizationOptions = (region: AdminRegion, period: AdminPeriod, district?: string) =>
  queryOptions({
    queryKey: [...ADMIN_QUERY_KEY, 'utilization', region, period, district ?? 'all'],
    queryFn: () => fetchUtilization(region, period, district),
  })

const adminChargersOptions = (region: AdminRegion, district?: string) =>
  queryOptions({
    queryKey: [...ADMIN_QUERY_KEY, 'chargers', region, district ?? 'all'],
    queryFn: () => fetchAdminChargers(region, district),
  })

const collectionStatusOptions = (region: AdminRegion) =>
  queryOptions({
    queryKey: [...ADMIN_QUERY_KEY, 'collection-status', region],
    queryFn: () => fetchCollectionStatus(region),
  })

const missingStatsOptions = (region: AdminRegion, period: AdminPeriod) =>
  queryOptions({
    queryKey: [...ADMIN_QUERY_KEY, 'missing-stats', region, period],
    queryFn: () => fetchMissingStats(region, period),
  })

export function useUtilizationQuery(region: AdminRegion, period: AdminPeriod, district?: string) {
  return useQuery({
    ...utilizationOptions(region, period, district),
    placeholderData: keepPreviousData,
  })
}

export function useAdminChargersQuery(region: AdminRegion, district?: string) {
  return useQuery({ ...adminChargersOptions(region, district), placeholderData: keepPreviousData })
}

export function useCollectionStatusQuery(region: AdminRegion) {
  return useQuery({ ...collectionStatusOptions(region), placeholderData: keepPreviousData })
}

export function useMissingStatsQuery(region: AdminRegion, period: AdminPeriod) {
  return useQuery({ ...missingStatsOptions(region, period), placeholderData: keepPreviousData })
}

/**
 * 운영자 화면이 처음 열릴 때 쓸 데이터를 미리 요청 — 로그인 확인 · 화면 코드 받기를 기다리지 않고 바로 시작
 * 화면 첫 지역(DEFAULT_ADMIN_REGION)과 같은 키라 화면이 열리면 받아 둔 값을 그대로 씀 (staleTime 동안 다시 안 부름)
 * 충전기 목록(11번)이 서버 계산으로 0.5초 넘게 걸려서 이걸 앞당기는 게 목적 (2026-11-27 실서버 측정)
 */
export function prefetchAdminPage(queryClient: QueryClient, pathname: string) {
  const region = DEFAULT_ADMIN_REGION
  // 운영 현황 — 충전기 목록 · 이용률 오늘 · 4주 · 수집 상태 · 오늘 결측 (useAdminStatusData와 같은 5개)
  if (pathname === '/admin') {
    void queryClient.prefetchQuery(adminChargersOptions(region))
    void queryClient.prefetchQuery(utilizationOptions(region, 'day'))
    void queryClient.prefetchQuery(utilizationOptions(region, 'week'))
    void queryClient.prefetchQuery(collectionStatusOptions(region))
    void queryClient.prefetchQuery(missingStatsOptions(region, 'day'))
  }
  // 상태 이상 충전기 — 운영 현황과 같은 충전기 목록 하나
  if (pathname === '/admin/charger-issues') {
    void queryClient.prefetchQuery(adminChargersOptions(region))
  }
  // 데이터 수집 화면은 요청이 모두 가벼워(약 0.17초) 미리 부르지 않음
}
