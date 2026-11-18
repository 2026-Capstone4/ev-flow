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

  // 지도 마커에도 고른 필터를 적용 (MAP-006)
  // 마커는 실시간 상태를 보여 주므로 혼잡 제외도 지금(0) 기준. 추천 시트의 시점과는 상관없음
  // 매번 새 배열이면 마커를 계속 다시 만들어서 데이터 · 필터 · 추천이 바뀔 때만 계산
  // (TanStack Query는 폴링 응답이 같으면 이전 배열을 그대로 돌려줘서 추천이 같으면 다시 계산하지 않음)
  // 지금 보는 시점 추천 Top 3의 충전소 ID. 마커를 형광 파랑으로 그리고 필터와 상관없이 남길 때 씀
  const recommendedIds = useMemo(
    () => new Set(recommendations?.map((r) => r.station.stationId)),
    [recommendations],
  )
  const allStations = stationsQuery.data?.stations
  const stations = useMemo(() => {
    // 충전소 목록을 아직 못 받았으면 마커 없음
    if (!allStations) return undefined
    // 추천된 충전소는 필터와 상관없이 남김. 추천은 고른 시점으로 거르고 마커는 지금 기준이라,
    // 30분 후 '여유'로 추천된 곳이 지금 '혼잡'이라는 이유로 지도에서 빠지지 않게 함
    return allStations.filter(
      (station) => matchesFilters(station, filters, 0) || recommendedIds.has(station.stationId),
    )
  }, [allStations, filters, recommendedIds])

  return {
    stations,
    // 필터 패널에서 고르는 중인 조건에 맞는 곳 수를 미리 셀 때 씀
    allStations,
    updatedAt: stationsQuery.data ? new Date(stationsQuery.data.updatedAt) : null,
    isStationsError: stationsQuery.isError,
    recommendations,
    recommendedIds,
    recommendState: getListLoadState(recommendations, recommendationsQuery.isError),
  }
}
