import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchRecommendations, fetchRoute, fetchStation, fetchStations } from '../api/stations'
import { isDefaultFilters } from '../lib/stationFilter'
import { loadStationsCache, saveStationsCache } from '../lib/stationsCache'
import type { LatLng } from '../types/geo'
import type { RecommendationFilters } from '../types/station'

// 폴링 · 캐시 설정은 queryClient 기본값 사용. 실패 시 마지막 정상값(data)은 그대로 유지됨
// 모든 시점 예측을 한 번에 받으므로 예측 시점은 쿼리 키에 넣지 않음
export function useStationsQuery() {
  return useQuery({
    queryKey: ['stations'],
    queryFn: async () => {
      const response = await fetchStations()
      // 다음 방문 때 마커를 바로 그리도록 받을 때마다 저장
      saveStationsCache(response)
      return response
    },
    // 저장해 둔 목록으로 먼저 그림. 받은 시각을 0으로 둬서 바로 낡은 값으로 보고 곧장 새로 받음
    initialData: () => loadStationsCache(),
    initialDataUpdatedAt: 0,
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

/** 서버 경로 캐시와 같은 기간 (route:v1 키, 30분). 그 안에 같은 충전소로 다시 들어오면 서버를 부르지 않음 */
const ROUTE_CACHE_TIME_MS = 30 * 60_000

/** 서버 경로 캐시 키와 같은 자리수(소수 4자리, 약 10m). 위치가 조금만 흔들려도 새로 부르지 않게 함 */
function roundCoord(value: number) {
  return Math.round(value * 10_000) / 10_000
}

// 길찾기는 화면 주기 갱신에 넣지 않음 (docs/api/README.md, Directions 호출량)
// 실패해도 자동으로 다시 부르지 않음. 경로 오류(502 · 503)는 다시 불러도 같거나 Directions를 한 번 더 쓰므로 재시도 버튼으로만
// 실패한 쿼리는 데이터가 없어 staleTime과 상관없이 창 포커스 · 네트워크 복귀 때 다시 불리므로 둘 다 끔
export function useRouteQuery(origin: LatLng, stationId: string) {
  return useQuery({
    queryKey: ['routes', roundCoord(origin.lat), roundCoord(origin.lng), stationId],
    queryFn: () => fetchRoute({ origin, stationId }),
    refetchInterval: false,
    staleTime: Infinity,
    gcTime: ROUTE_CACHE_TIME_MS,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
