import { createContext } from 'react'
import type { HorizonMinutes, RecommendationFilters } from '@/types/station'

/** 지도 홈 · 검색 화면이 함께 쓰는 예측 시점 · 필터. 화면을 오가도 유지됨 */
export type MapView = {
  horizon: HorizonMinutes
  setHorizon: (horizon: HorizonMinutes) => void
  filters: RecommendationFilters
  setFilters: (filters: RecommendationFilters) => void
}

export const MapViewContext = createContext<MapView | null>(null)
