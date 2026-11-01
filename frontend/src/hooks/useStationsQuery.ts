import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchRecommendations, fetchStations } from '@/api/stations'
import type { LatLng } from '@/types/geo'
import type { HorizonMinutes } from '@/types/station'

// 폴링 · 캐시 설정은 queryClient 기본값 사용. 실패 시 마지막 정상값(data)은 그대로 유지됨
export function useStationsQuery(horizonMinutes: HorizonMinutes) {
  return useQuery({
    queryKey: ['stations', horizonMinutes],
    queryFn: () => fetchStations(horizonMinutes),
    placeholderData: keepPreviousData,
  })
}

export function useRecommendationsQuery(horizonMinutes: HorizonMinutes, origin: LatLng) {
  return useQuery({
    queryKey: ['recommendations', horizonMinutes, origin.lat, origin.lng],
    queryFn: () => fetchRecommendations(horizonMinutes, origin),
    placeholderData: keepPreviousData,
  })
}
