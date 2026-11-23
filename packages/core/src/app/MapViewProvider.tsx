import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { MapViewContext } from './mapViewContext'
import { DEFAULT_HORIZON, DEMO_USER_LOCATION } from '../lib/constants'
import { DEFAULT_FILTERS } from '../lib/stationFilter'
import type { LatLng } from '../types/geo'
import type { HorizonMinutes, RecommendationFilters } from '../types/station'

/**
 * 지도 화면 사이에 시점 · 필터 · 사용자 위치 · 추천 기준점을 나눠 씀
 * 추천 기준점 · 마지막 추천 시각을 여기 두는 이유: 웹은 상세로 갔다 오면 지도 화면이 새로 그려져도 5분 규칙이 이어지게 함
 * initialUserLocation: 처음 사용자 위치 · 추천 기준점. 앱은 시연 위치 환경 변수(EXPO_PUBLIC_DEMO_LOCATION)를 넣고, 웹은 안 넣어 합정역을 씀
 */
export function MapViewProvider({
  children,
  initialUserLocation = DEMO_USER_LOCATION,
}: {
  children: ReactNode
  initialUserLocation?: LatLng
}) {
  const [horizon, setHorizon] = useState<HorizonMinutes>(DEFAULT_HORIZON)
  const [filters, setFilters] = useState<RecommendationFilters>(DEFAULT_FILTERS)
  const [userLocation, setUserLocation] = useState<LatLng>(initialUserLocation)
  const [recommendOrigin, setRecommendOrigin] = useState<LatLng>(initialUserLocation)
  const [lastRecommendAt, setLastRecommendAt] = useState<number | null>(null)
  const markRecommendCalled = useCallback(() => setLastRecommendAt(Date.now()), [])
  const value = useMemo(
    () => ({
      horizon,
      setHorizon,
      filters,
      setFilters,
      userLocation,
      setUserLocation,
      recommendOrigin,
      setRecommendOrigin,
      lastRecommendAt,
      markRecommendCalled,
    }),
    [horizon, filters, userLocation, recommendOrigin, lastRecommendAt, markRecommendCalled],
  )
  return <MapViewContext.Provider value={value}>{children}</MapViewContext.Provider>
}
