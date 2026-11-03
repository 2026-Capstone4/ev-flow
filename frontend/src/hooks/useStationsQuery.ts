import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchRecommendations, fetchStation, fetchStations } from '@/api/stations'
import { isDefaultFilters } from '@/lib/stationFilter'
import type { LatLng } from '@/types/geo'
import type { RecommendationFilters } from '@/types/station'

// 폴링 · 캐시 설정은 queryClient 기본값 사용. 실패 시 마지막 정상값(data)은 그대로 유지됨
// 15 · 30 · 60분 예측을 한 번에 받으므로 예측 시점은 쿼리 키에 넣지 않음
export function useStationsQuery() {
  return useQuery({
    queryKey: ['stations'],
    queryFn: fetchStations,
  })
}

export function useStationQuery(stationId: string) {
  return useQuery({
    queryKey: ['stations', stationId],
    queryFn: () => fetchStation(stationId),
  })
}

// 화면에 적용 중인 필터를 그대로 보냄 (REC-004). 기본 필터면 생략 = 전체
export function useRecommendationsQuery(origin: LatLng, filters: RecommendationFilters) {
  return useQuery({
    queryKey: ['recommendations', origin.lat, origin.lng, filters],
    queryFn: () =>
      fetchRecommendations({
        lat: origin.lat,
        lng: origin.lng,
        ...(isDefaultFilters(filters) ? {} : { filters }),
      }),
    placeholderData: keepPreviousData,
  })
}
