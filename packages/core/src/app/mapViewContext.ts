import { createContext } from 'react'
import type { LatLng } from '../types/geo'
import type { HorizonMinutes, RecommendationFilters } from '../types/station'

/** 지도 홈 · 검색 · 길찾기 화면이 함께 쓰는 예측 시점 · 필터 · 사용자 위치. 화면을 오가도 유지됨 */
export type MapView = {
  horizon: HorizonMinutes
  setHorizon: (horizon: HorizonMinutes) => void
  filters: RecommendationFilters
  setFilters: (filters: RecommendationFilters) => void
  /** 추천 · 검색 거리 · 길찾기 출발지 기준. 현재 위치 버튼을 누르기 전에는 시연용 고정 좌표 */
  userLocation: LatLng
  setUserLocation: (location: LatLng) => void
}

export const MapViewContext = createContext<MapView | null>(null)
