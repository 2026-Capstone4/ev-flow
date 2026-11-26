import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useScreenActive } from '../app/screenActive'
import {
  fetchNationwideServiceAreaChargers,
  fetchNationwideServiceAreas,
} from '../api/serviceAreas'

// 폴링 · 캐시 설정은 queryClient 기본값 사용

/** 전국 휴게소 목록 쿼리 키. 목록 쿼리와 미리 받기가 같은 캐시를 씀 */
const NATIONWIDE_QUERY_KEY = ['service-areas', 'nationwide']

/** 전국 휴게소 목록. 휴게소 탭 · 노선 화면 · 지역 화면이 같은 쿼리 키를 같이 써서 화면을 옮겨도 다시 부르지 않음 */
export function useNationwideServiceAreasQuery() {
  const isScreenActive = useScreenActive()
  return useQuery({
    queryKey: NATIONWIDE_QUERY_KEY,
    // 화면이 가려지면(앱 스택 뒤) 구독을 끊어 폴링을 멈춤. 웹은 항상 true
    subscribed: isScreenActive,
    queryFn: fetchNationwideServiceAreas,
  })
}

/**
 * 전국 휴게소 목록을 미리 받아 캐시에 넣어 둠. 앱 지도 화면이 첫 데이터를 받은 뒤 부름
 * 하단 탭은 처음 열 때 화면을 만들어서, 미리 안 받으면 휴게소 탭을 누른 뒤에야 요청이 나가 빈 패널이 보임
 * 지켜보는 화면이 없어 폴링은 돌지 않고, 받아 둔 값이 낡았으면 휴게소 탭을 열 때 새로 받음
 */
export function usePrefetchNationwideServiceAreas(isEnabled: boolean) {
  const queryClient = useQueryClient()
  useEffect(() => {
    // 지도 데이터를 받기 전에는 그 요청과 겹치지 않게 기다림
    if (!isEnabled) return
    void queryClient.prefetchQuery({
      queryKey: NATIONWIDE_QUERY_KEY,
      queryFn: fetchNationwideServiceAreas,
    })
  }, [isEnabled, queryClient])
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
