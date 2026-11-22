import { useMemo, useState, type ReactNode } from 'react'
import { MapViewContext } from './mapViewContext'
import { DEFAULT_HORIZON, DEMO_USER_LOCATION } from '../lib/constants'
import { DEFAULT_FILTERS } from '../lib/stationFilter'
import type { LatLng } from '../types/geo'
import type { HorizonMinutes, RecommendationFilters } from '../types/station'

/**
 * 지도 화면 사이에 시점 · 필터 · 추천 기준 위치를 나눠 씀
 * initialUserLocation: 처음 추천 기준 위치. 앱은 시연 위치 환경 변수(EXPO_PUBLIC_DEMO_LOCATION)를 넣고, 웹은 안 넣어 합정역을 씀
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
  const value = useMemo(
    () => ({ horizon, setHorizon, filters, setFilters, userLocation, setUserLocation }),
    [horizon, filters, userLocation],
  )
  return <MapViewContext.Provider value={value}>{children}</MapViewContext.Provider>
}
