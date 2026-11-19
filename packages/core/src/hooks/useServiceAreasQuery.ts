import { useQuery } from '@tanstack/react-query'
import { useScreenActive } from '../app/screenActive'
import { fetchServiceAreaChargers, fetchServiceAreas } from '../api/serviceAreas'
import type { Direction } from '../types/serviceArea'

// 폴링 · 캐시 설정은 queryClient 기본값 사용
export function useServiceAreasQuery() {
  const isScreenActive = useScreenActive()
  return useQuery({
    queryKey: ['service-areas'],
    // 화면이 가려지면(앱 스택 뒤) 구독을 끊어 폴링을 멈춤. 웹은 항상 true
    subscribed: isScreenActive,
    queryFn: fetchServiceAreas,
  })
}

export function useServiceAreaChargersQuery(name: string, direction: Direction) {
  const isScreenActive = useScreenActive()
  return useQuery({
    queryKey: ['service-areas', name, direction],
    // 화면이 가려지면(앱 스택 뒤) 구독을 끊어 폴링을 멈춤. 웹은 항상 true
    subscribed: isScreenActive,
    queryFn: () => fetchServiceAreaChargers(name, direction),
  })
}
