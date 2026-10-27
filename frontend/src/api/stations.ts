import { api } from '@/api/client'
import type { LatLng } from '@/types/geo'
import type { HorizonMinutes, RecommendationsResponse, StationsResponse } from '@/types/station'

// TODO(fe): 백엔드 명세 확정 후 경로 · 파라미터 교체 (API-01)
export async function fetchStations(horizonMinutes: HorizonMinutes) {
  const { data } = await api.get<StationsResponse>('/stations', {
    params: { horizon: horizonMinutes },
  })
  return data
}

export async function fetchRecommendations(horizonMinutes: HorizonMinutes, origin: LatLng) {
  const { data } = await api.get<RecommendationsResponse>('/recommendations', {
    params: { horizon: horizonMinutes, lat: origin.lat, lng: origin.lng },
  })
  return data
}
