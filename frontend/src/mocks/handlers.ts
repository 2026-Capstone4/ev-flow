import { delay, http, HttpResponse, type DefaultBodyType, type PathParams } from 'msw'
import { HORIZONS } from '@/lib/horizon'
import { buildRecommendations } from '@/mocks/data/recommendations'
import { buildMockRoute } from '@/mocks/data/routes'
import { findServiceAreaChargers, SERVICE_AREAS } from '@/mocks/data/serviceAreas'
import { findStationDetail, STATIONS, toKstIso } from '@/mocks/data/stations'
import type { ApiErrorBody } from '@/types/api'
import type { ServiceAreaChargersResponse, ServiceAreasResponse } from '@/types/serviceArea'
import type {
  RecommendationsRequest,
  RecommendationsResponse,
  RouteRequest,
  RouteResponse,
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
    const { lat, lng, filters } = await request.json()
    await delay(300)
    return HttpResponse.json<RecommendationsResponse>({
      updatedAt: toKstIso(new Date()),
      dataQuality: 'normal',
      results: HORIZONS.map((horizon) => buildRecommendations({ lat, lng }, horizon, filters)),
    })
  }),

  http.post<never, RouteRequest, ApiErrorBody | RouteResponse>(
    '/api/v1/routes',
    async ({ request }) => {
      const { origin, stationId } = await request.json()
      await delay(400)
      const station = STATIONS.find((s) => s.stationId === stationId)
      if (!station) {
        return HttpResponse.json<ApiErrorBody>(
          { error: { code: 'STATION_NOT_FOUND', message: '충전소를 찾을 수 없습니다.' } },
          { status: 404 },
        )
      }
      const route = buildMockRoute(origin, station)
      if (!route) {
        return HttpResponse.json<ApiErrorBody>(
          { error: { code: 'ROUTE_NOT_FOUND', message: '경로를 찾을 수 없습니다.' } },
          { status: 404 },
        )
      }
      return HttpResponse.json<RouteResponse>(route)
    },
  ),

  http.get('/api/v1/service-areas', async () => {
    await delay(300)
    return HttpResponse.json<ServiceAreasResponse>({
      updatedAt: toKstIso(new Date()),
      dataQuality: 'normal',
      serviceAreas: SERVICE_AREAS,
    })
  }),

  http.get<PathParams, DefaultBodyType, ApiErrorBody | ServiceAreaChargersResponse>(
    '/api/v1/service-areas/chargers',
    async ({ request }) => {
      await delay(300)
      const url = new URL(request.url)
      const name = url.searchParams.get('name')
      const direction = url.searchParams.get('direction')
      if (!name || (direction !== 'up' && direction !== 'down')) {
        return HttpResponse.json<ApiErrorBody>(
          { error: { code: 'VALIDATION_ERROR', message: '요청 형식이 올바르지 않습니다.' } },
          { status: 422 },
        )
      }
      const found = findServiceAreaChargers(name, direction, new Date())
      if (!found) {
        return HttpResponse.json<ApiErrorBody>(
          { error: { code: 'SERVICE_AREA_NOT_FOUND', message: '휴게소를 찾을 수 없습니다.' } },
          { status: 404 },
        )
      }
      return HttpResponse.json<ServiceAreaChargersResponse>({
        updatedAt: toKstIso(new Date()),
        dataQuality: 'normal',
        ...found,
      })
    },
  ),
]
