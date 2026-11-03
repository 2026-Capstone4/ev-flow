import { delay, http, HttpResponse } from 'msw'
import { buildRecommendations } from '@/mocks/data/recommendations'
import { STATIONS } from '@/mocks/data/stations'
import type {
  HorizonMinutes,
  RecommendationsRequest,
  RecommendationsResponse,
  StationsResponse,
} from '@/types/station'

const HORIZONS: HorizonMinutes[] = [15, 30, 60]

// 서버는 +09:00 오프셋을 붙여 보냄 (BE-09)
function nowKst() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return kst.toISOString().replace(/\.\d{3}Z$/, '+09:00')
}

export const handlers = [
  http.get('/api/v1/stations', async () => {
    await delay(300)
    return HttpResponse.json<StationsResponse>({
      updatedAt: nowKst(),
      dataQuality: 'normal',
      stations: STATIONS,
    })
  }),

  http.post<never, RecommendationsRequest>('/api/v1/recommendations', async ({ request }) => {
    const { lat, lng } = await request.json()
    await delay(300)
    return HttpResponse.json<RecommendationsResponse>({
      updatedAt: nowKst(),
      dataQuality: 'normal',
      results: HORIZONS.map((horizon) => buildRecommendations({ lat, lng }, horizon)),
    })
  }),
]
