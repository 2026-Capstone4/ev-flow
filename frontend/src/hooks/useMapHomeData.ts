import { useMemo } from 'react'
import { useRecommendationsQuery, useStationsQuery } from '@/hooks/useStationsQuery'
import { getListLoadState } from '@/lib/loadState'
import { matchesFilters } from '@/lib/stationFilter'
import type { LatLng } from '@/types/geo'
import type { HorizonMinutes, RecommendationFilters } from '@/types/station'

// 지도 홈 화면 데이터. 화면(JSX)과 분리해 RN 전환 시 그대로 재사용
export function useMapHomeData(
  origin: LatLng,
  horizon: HorizonMinutes,
  filters: RecommendationFilters,
) {
  const stationsQuery = useStationsQuery()
  const recommendationsQuery = useRecommendationsQuery(origin, filters)
  // 시점을 바꿔도 다시 요청하지 않고 받은 결과에서 고름
  const recommendations = recommendationsQuery.data?.results.find(
    (result) => result.horizonMinutes === horizon,
  )?.recommendations

  // 지도 마커에도 검색 화면에서 고른 필터를 적용 (MAP-006)
  // 매번 새 배열이면 마커를 계속 다시 만들어서 데이터 · 필터가 바뀔 때만 계산
  const allStations = stationsQuery.data?.stations
  const stations = useMemo(
    () => allStations?.filter((station) => matchesFilters(station, filters)),
    [allStations, filters],
  )

  return {
    stations,
    updatedAt: stationsQuery.data ? new Date(stationsQuery.data.updatedAt) : null,
    isStationsError: stationsQuery.isError,
    recommendations,
    recommendState: getListLoadState(recommendations, recommendationsQuery.isError),
  }
}
