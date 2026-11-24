import { useQuery } from '@tanstack/react-query'
import { useScreenActive } from '../app/screenActive'
import {
  fetchNationwideServiceAreaChargers,
  fetchNationwideServiceAreas,
  fetchServiceAreaChargers,
  fetchServiceAreas,
} from '../api/serviceAreas'
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

/** 전국 휴게소 목록. 휴게소 탭 · 노선 화면 · 지역 화면이 같은 쿼리 키를 같이 써서 화면을 옮겨도 다시 부르지 않음 */
export function useNationwideServiceAreasQuery() {
  const isScreenActive = useScreenActive()
  return useQuery({
    queryKey: ['service-areas', 'nationwide'],
    // 화면이 가려지면(앱 스택 뒤) 구독을 끊어 폴링을 멈춤. 웹은 항상 true
    subscribed: isScreenActive,
    queryFn: fetchNationwideServiceAreas,
  })
}

/** 전국 휴게소 한 곳의 충전기 현황 */
export function useNationwideServiceAreaChargersQuery(id: string) {
  const isScreenActive = useScreenActive()
  return useQuery({
    queryKey: ['service-areas', 'nationwide', id],
    subscribed: isScreenActive,
    queryFn: () => fetchNationwideServiceAreaChargers(id),
  })
}
