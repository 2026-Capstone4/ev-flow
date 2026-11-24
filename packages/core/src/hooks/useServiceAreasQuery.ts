import { useQueries, useQuery } from '@tanstack/react-query'
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

/**
 * 전국 휴게소 충전기 현황. 노선 미확인을 묶은 휴게소는 statId가 여럿이라 id마다 16번을 따로 부름
 * 쿼리 키는 id 하나씩이라 같은 충전소를 다른 화면에서 열어도 캐시를 같이 씀
 */
export function useNationwideServiceAreaChargersQueries(ids: string[]) {
  const isScreenActive = useScreenActive()
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['service-areas', 'nationwide', id],
      // 화면이 가려지면(앱 스택 뒤) 구독을 끊어 폴링을 멈춤. 웹은 항상 true
      subscribed: isScreenActive,
      queryFn: () => fetchNationwideServiceAreaChargers(id),
    })),
  })
}
