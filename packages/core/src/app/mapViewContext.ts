import { createContext } from 'react'
import type { LatLng } from '../types/geo'
import type { HorizonMinutes, RecommendationFilters } from '../types/station'

/** 지도 홈 · 검색 · 길찾기 화면이 함께 쓰는 예측 시점 · 필터 · 사용자 위치 · 추천 기준점. 화면을 오가도 유지됨 */
export type MapView = {
  horizon: HorizonMinutes
  setHorizon: (horizon: HorizonMinutes) => void
  filters: RecommendationFilters
  setFilters: (filters: RecommendationFilters) => void
  /**
   * 지금 사용자 위치 (마포구 안에서 잰 최신 값). 위치 추적 · 현재 위치 버튼이 바꿈
   * 검색 거리 · 길찾기 출발지 · 내 위치 마커 기준. 위치를 재기 전에는 시연용 고정 좌표
   */
  userLocation: LatLng
  setUserLocation: (location: LatLng) => void
  /** userLocation이 기기에서 잰 위치인지. 아직 시연용 고정 좌표면 false */
  isUserLocationMeasured: boolean
  /**
   * 추천을 부른 위치. userLocation이 바뀌어도 500m · 2분 · 5분 규칙(useRecommendationOrigin)으로만 바뀜
   * 단, 추천을 한 번도 부르기 전에는 userLocation을 그대로 따라감
   */
  recommendOrigin: LatLng
  /** isMeasured: 옮겨 갈 위치가 기기에서 잰 위치인지 (isUserLocationMeasured 값을 그대로 넘김) */
  setRecommendOrigin: (location: LatLng, isMeasured: boolean) => void
  /** recommendOrigin이 기기에서 잰 위치인지. 시연 위치에서 부른 추천이면 false */
  isRecommendOriginMeasured: boolean
  /** 마지막으로 추천 서버를 부른 시각(ms). 아직 안 불렀으면 null */
  lastRecommendAt: number | null
  markRecommendCalled: () => void
}

export const MapViewContext = createContext<MapView | null>(null)
