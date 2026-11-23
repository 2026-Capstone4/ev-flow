import { useMemo } from 'react'
import { useMapView } from './useMapView'
import { useRecommendationOrigin } from './useRecommendationOrigin'
import { getApiErrorCode, getRetryAfterSeconds } from '../api/errors'
import { useRecommendationsQuery, useStationsQuery } from './useStationsQuery'
import { getListLoadState, type ListLoadState } from '../lib/loadState'
import { matchesFilters } from '../lib/stationFilter'
import type { HorizonMinutes, RecommendationFilters } from '../types/station'

/** 추천 시트 표시 상태. 목록 상태에 마포구 밖(out_of_area) · 호출 제한(rate_limited)이 더해짐 */
export type RecommendState = ListLoadState | 'out_of_area' | 'rate_limited'

// 지도 홈 화면 데이터. 화면(JSX)과 분리해 RN 전환 시 그대로 재사용
// 추천은 사용자 위치가 아니라 추천 기준점으로 부름 - 5분마다 또는 500m + 2분마다 기준점이 지금 위치로 옮겨짐
export function useMapHomeData(horizon: HorizonMinutes, filters: RecommendationFilters) {
  const stationsQuery = useStationsQuery()
  const { recommendOrigin, markRecommendCalled } = useMapView()
  const recommendationsQuery = useRecommendationsQuery(
    recommendOrigin,
    filters,
    markRecommendCalled,
  )
  useRecommendationOrigin(recommendationsQuery.refetch)
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
    recommendState: getRecommendState(
      getListLoadState(recommendations, recommendationsQuery.isError),
      recommendationsQuery.error,
    ),
    /** 호출 제한(rate_limited)일 때 다시 시도할 수 있기까지 남은 초. 모르면 null */
    recommendRetryAfterSeconds: getRetryAfterSeconds(recommendationsQuery.error),
  }
}

/**
 * 추천 오류를 서버 code로 나눠 일반 오류와 다른 안내를 띄움.
 * 마포구 밖(422 OUT_OF_SERVICE_AREA) · 호출 제한(429 RATE_LIMITED)
 */
export function getRecommendState(listState: ListLoadState, error: unknown): RecommendState {
  // 오류가 아니면(마지막 정상값이 있는 경우 포함) 목록 상태 그대로
  if (listState !== 'error') return listState
  const code = getApiErrorCode(error)
  // 서버가 마포구 밖이라고 알려 주면 마포구만 지원한다는 안내
  if (code === 'OUT_OF_SERVICE_AREA') return 'out_of_area'
  // 추천 호출이 너무 잦으면 잠시 후 다시 하라는 안내
  if (code === 'RATE_LIMITED') return 'rate_limited'
  return listState
}
