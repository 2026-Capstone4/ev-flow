import { delay, http, HttpResponse } from 'msw'
import { MOCK_STATIONS, toStation } from '@/mocks/data/stations'
import type { HorizonMinutes, RecommendationsResponse, StationsResponse } from '@/types/station'

function parseHorizon(url: URL): HorizonMinutes {
  const value = Number(url.searchParams.get('horizon'))
  return value === 15 || value === 60 ? value : 30
}

export const handlers = [
  http.get('/api/stations', async ({ request }) => {
    const horizonMinutes = parseHorizon(new URL(request.url))
    await delay(300)
    return HttpResponse.json<StationsResponse>({
      horizonMinutes,
      updatedAt: new Date().toISOString(),
      stations: MOCK_STATIONS.map((station) => toStation(station, horizonMinutes)),
    })
  }),

  http.get('/api/recommendations', async ({ request }) => {
    const horizonMinutes = parseHorizon(new URL(request.url))
    const pick = (stationId: string) =>
      toStation(
        MOCK_STATIONS.find((station) => station.stationId === stationId)!,
        horizonMinutes,
      )
    await delay(300)
    return HttpResponse.json<RecommendationsResponse>({
      horizonMinutes,
      updatedAt: new Date().toISOString(),
      recommendations: [
        {
          rank: 1,
          station: pick('MOCK0001'),
          travelTimeMinutes: 8,
          reason: '가장 가까운 곳보다 4분 더 이동, 대기 12분 감소',
        },
        {
          rank: 2,
          station: pick('MOCK0005'),
          travelTimeMinutes: 9,
          reason: '이동 시간은 비슷하고 대기가 짧음',
        },
        {
          rank: 3,
          station: pick('MOCK0002'),
          travelTimeMinutes: 4,
          reason: '가장 가까운 충전소',
        },
      ],
    })
  }),
]
