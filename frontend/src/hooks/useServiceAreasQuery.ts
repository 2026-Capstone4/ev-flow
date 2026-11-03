import { useQuery } from '@tanstack/react-query'
import { fetchServiceAreaChargers, fetchServiceAreas } from '@/api/serviceAreas'
import type { Direction } from '@/types/serviceArea'

// 폴링 · 캐시 설정은 queryClient 기본값 사용
export function useServiceAreasQuery() {
  return useQuery({
    queryKey: ['service-areas'],
    queryFn: fetchServiceAreas,
  })
}

export function useServiceAreaChargersQuery(name: string, direction: Direction) {
  return useQuery({
    queryKey: ['service-areas', name, direction],
    queryFn: () => fetchServiceAreaChargers(name, direction),
  })
}
