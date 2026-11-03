import { api } from '@/api/client'
import type {
  RecommendationsRequest,
  RecommendationsResponse,
  RouteRequest,
  RouteResponse,
  StationDetailResponse,
  StationsResponse,
} from '@/types/station'

export async function fetchStations() {
  const { data } = await api.get<StationsResponse>('/stations')
  return data
}

export async function fetchStation(stationId: string) {
  const { data } = await api.get<StationDetailResponse>(
    `/stations/${encodeURIComponent(stationId)}`,
  )
  return data
}

// 위치 좌표가 접근 로그에 남지 않도록 POST 본문으로 보냄 (SER-002)
export async function fetchRecommendations(request: RecommendationsRequest) {
  const { data } = await api.post<RecommendationsResponse>('/recommendations', request)
  return data
}

// 사용자가 충전소를 선택할 때만 요청 — 주기 갱신에 넣지 않음 (Directions 호출량)
export async function fetchRoute(request: RouteRequest) {
  const { data } = await api.post<RouteResponse>('/routes', request)
  return data
}
