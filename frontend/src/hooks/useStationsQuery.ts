import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchRecommendations, fetchStations } from '@/api/stations'
import type { LatLng } from '@/types/geo'

// 폴링 · 캐시 설정은 queryClient 기본값 사용. 실패 시 마지막 정상값(data)은 그대로 유지됨
// 15 · 30 · 60분 예측을 한 번에 받으므로 예측 시점은 쿼리 키에 넣지 않음
export function useStationsQuery() {
  return useQuery({
    queryKey: ['stations'],
    queryFn: fetchStations,
  })
}

export function useRecommendationsQuery(origin: LatLng) {
  return useQuery({
    queryKey: ['recommendations', origin.lat, origin.lng],
    queryFn: () => fetchRecommendations({ lat: origin.lat, lng: origin.lng }),
    placeholderData: keepPreviousData,
  })
}
