import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
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
  const [userLocation, setUserLocationState] = useState<LatLng>(initialUserLocation)
  const [recommendOrigin, setRecommendOriginState] = useState<LatLng>(initialUserLocation)
  // 처음엔 둘 다 시연 위치라 false. 위치 추적 · 현재 위치 버튼이 한 번이라도 재면 true
  const [isUserLocationMeasured, setIsUserLocationMeasured] = useState(false)
  const [isRecommendOriginMeasured, setIsRecommendOriginMeasured] = useState(false)
  // 추천을 한 번이라도 불렀는지. 위치를 바꿀 때 바로 읽어야 해서 state가 아닌 ref로 둠
  const hasRecommendCalledRef = useRef(false)
  const setRecommendOrigin = useCallback((location: LatLng, isMeasured: boolean) => {
    setRecommendOriginState(location)
    setIsRecommendOriginMeasured(isMeasured)
  }, [])
  const setUserLocation = useCallback(
    (location: LatLng) => {
      setUserLocationState(location)
      setIsUserLocationMeasured(true)
      // 아직 추천을 한 번도 안 불렀으면 기준점도 같이 옮김. 부르기 전이라 옮겨도 호출이 늘지 않음
      if (!hasRecommendCalledRef.current) setRecommendOrigin(location, true)
    },
    [setRecommendOrigin],
  )
  const [lastRecommendAt, setLastRecommendAt] = useState<number | null>(null)
  const markRecommendCalled = useCallback(() => {
    hasRecommendCalledRef.current = true
    setLastRecommendAt(Date.now())
  }, [])
  const value = useMemo(
    () => ({
      horizon,
      setHorizon,
      filters,
      setFilters,
      userLocation,
      setUserLocation,
      isUserLocationMeasured,
      recommendOrigin,
      setRecommendOrigin,
      isRecommendOriginMeasured,
      lastRecommendAt,
      markRecommendCalled,
    }),
    [
      horizon,
      filters,
      userLocation,
      setUserLocation,
      isUserLocationMeasured,
      recommendOrigin,
      setRecommendOrigin,
      isRecommendOriginMeasured,
      lastRecommendAt,
      markRecommendCalled,
    ],
  )
  return <MapViewContext.Provider value={value}>{children}</MapViewContext.Provider>
}
