import { delay, http, HttpResponse } from 'msw'
import { HORIZONS } from '@/lib/horizon'
import { buildRecommendations } from '@/mocks/data/recommendations'
import { findStationDetail, STATIONS, toKstIso } from '@/mocks/data/stations'
import type { ApiErrorBody } from '@/types/api'
import type {
  RecommendationsRequest,
  RecommendationsResponse,
  StationDetailResponse,
  StationsResponse,
} from '@/types/station'

export const handlers = [
  http.get('/api/v1/stations', async () => {
    await delay(300)
    return HttpResponse.json<StationsResponse>({
      updatedAt: toKstIso(new Date()),
      dataQuality: 'normal',
      stations: STATIONS,
    })
  }),

  http.get<{ stationId: string }>('/api/v1/stations/:stationId', async ({ params }) => {
    await delay(300)
    const station = findStationDetail(params.stationId, new Date())
    if (!station) {
      return HttpResponse.json<ApiErrorBody>(
        { error: { code: 'STATION_NOT_FOUND', message: '충전소를 찾을 수 없습니다.' } },
        { status: 404 },
      )
    }
    return HttpResponse.json<StationDetailResponse>({
      updatedAt: toKstIso(new Date()),
      dataQuality: 'normal',
      station,
    })
  }),

  http.post<never, RecommendationsRequest>('/api/v1/recommendations', async ({ request }) => {
    const { lat, lng } = await request.json()
    await delay(300)
    return HttpResponse.json<RecommendationsResponse>({
      updatedAt: toKstIso(new Date()),
      dataQuality: 'normal',
      results: HORIZONS.map((horizon) => buildRecommendations({ lat, lng }, horizon)),
    })
  }),
]
