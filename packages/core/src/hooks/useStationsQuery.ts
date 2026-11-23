import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useScreenActive } from '../app/screenActive'
import { RECOMMEND_INTERVAL_MS } from '../lib/constants'
import { fetchRecommendations, fetchRoute, fetchStation, fetchStations } from '../api/stations'
import { isDefaultFilters } from '../lib/stationFilter'
import { loadStationsCache, saveStationsCache } from '../lib/stationsCache'
import type { LatLng } from '../types/geo'
import type { RecommendationFilters } from '../types/station'

// 폴링 · 캐시 설정은 queryClient 기본값 사용. 실패 시 마지막 정상값(data)은 그대로 유지됨
// 모든 시점 예측을 한 번에 받으므로 예측 시점은 쿼리 키에 넣지 않음
export function useStationsQuery() {
  const isScreenActive = useScreenActive()
  return useQuery({
    queryKey: ['stations'],
    // 화면이 가려지면(앱 스택 뒤) 구독을 끊어 폴링을 멈춤. 웹은 항상 true
    subscribed: isScreenActive,
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
  const isScreenActive = useScreenActive()
  return useQuery({
    queryKey: ['stations', stationId],
    // 화면이 가려지면(앱 스택 뒤) 구독을 끊어 폴링을 멈춤. 웹은 항상 true
    subscribed: isScreenActive,
    queryFn: () => fetchStation(stationId),
  })
}

// 화면에 적용 중인 필터를 그대로 보냄 (REC-004). 기본 필터면 생략 = 전체
// origin은 추천 기준점(useRecommendationOrigin). 언제 다시 부를지는 기준점 훅이 정해서 여기서는 주기 갱신을 끔
// 키가 같으면 5분 동안 받아 둔 결과를 다시 보여 주고(필터를 바꿨다 되돌린 경우), 5분 지난 결과는 버림
// onCall: 서버를 실제로 부를 때마다 불러 마지막 추천 시각을 남김
export function useRecommendationsQuery(
  origin: LatLng,
  filters: RecommendationFilters,
  onCall?: () => void,
) {
  const isScreenActive = useScreenActive()
  return useQuery({
    queryKey: ['recommendations', origin.lat, origin.lng, filters],
    // 화면이 가려지면(앱 스택 뒤) 구독을 끊음. 웹은 항상 true
    subscribed: isScreenActive,
    queryFn: () => {
      onCall?.()
      return fetchRecommendations({
        lat: origin.lat,
        lng: origin.lng,
        ...(isDefaultFilters(filters) ? {} : { filters }),
      })
    },
    placeholderData: keepPreviousData,
    staleTime: RECOMMEND_INTERVAL_MS,
    gcTime: RECOMMEND_INTERVAL_MS,
    refetchInterval: false,
    // 돌아올 때 · 다시 연결될 때도 기준점 훅이 5분 규칙으로 정함. 받은 결과가 없는 새 키는 그대로 바로 부름
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

// 길찾기는 화면 주기 갱신에 넣지 않음 (docs/api/README.md, Directions 호출량)
// 경로를 저장해 두지 않음 (2026-11-22 결정, 카카오 캐시 금지). 화면에 들어올 때 1번, 재시도 버튼으로만 다시 부름
// gcTime 0: 화면을 나가면 버려서, 다시 들어오면 새로 부름
// 실패해도 자동으로 다시 부르지 않음. 경로 오류(502 · 503)는 다시 불러도 같거나 Directions를 한 번 더 쓰므로 재시도 버튼으로만
// 실패한 쿼리는 데이터가 없어 staleTime과 상관없이 창 포커스 · 네트워크 복귀 때 다시 불리므로 둘 다 끔
// 화면 활성(subscribed)도 연결하지 않음. 폴링이 없어 끊을 게 없고, 다시 구독할 때 실패한 경로를 또 부르게 됨
// origin은 화면에 들어올 때 위치로 고정해서 넘김. 위치 추적으로 바뀌어도 다시 부르지 않게 함
export function useRouteQuery(origin: LatLng, stationId: string) {
  return useQuery({
    queryKey: ['routes', origin.lat, origin.lng, stationId],
    queryFn: () => fetchRoute({ origin, stationId }),
    refetchInterval: false,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
