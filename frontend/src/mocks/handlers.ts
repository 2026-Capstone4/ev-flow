import { bypass, delay, http, HttpResponse, type DefaultBodyType, type PathParams } from 'msw'
import { HORIZONS } from '@/lib/horizon'
import { buildRecommendations } from '@/mocks/data/recommendations'
import { buildMockRoute } from '@/mocks/data/routes'
import { findServiceAreaChargers, SERVICE_AREAS } from '@/mocks/data/serviceAreas'
import {
  fillMissingPredictions,
  findStationDetail,
  STATIONS,
  toKstIso,
} from '@/mocks/data/stations'
import type { ApiErrorBody } from '@/types/api'
import type { ServiceAreaChargersResponse, ServiceAreasResponse } from '@/types/serviceArea'
import type {
  RecommendationsRequest,
  RecommendationsResponse,
  RouteRequest,
  RouteResponse,
  Station,
  StationDetailResponse,
  StationsResponse,
} from '@/types/station'

/**
 * 추천 · 길찾기 핸들러에 충전소 목록을 넘겨주는 함수 모양.
 * 전체 Mock은 Mock 충전소를, 혼합 모드는 실제 서버 충전소를 돌려준다. 못 가져오면 null
 */
type StationSource = () => Promise<Station[] | null>

/** 충전소 목록을 못 가져왔을 때 돌려주는 503 응답 본문 (API 명세의 DATA_UNAVAILABLE) */
const DATA_UNAVAILABLE: ApiErrorBody = {
  error: { code: 'DATA_UNAVAILABLE', message: '충전 상태 데이터를 불러올 수 없습니다.' },
}

/** 충전소 목록 · 상세 API - 전체 Mock 모드에서만 씀 (혼합 모드에서는 실제 서버가 응답) */
const stationHandlers = [
  // 지도 홈 마커용 충전소 목록. Mock 충전소 전체를 돌려줌
  http.get('/api/v1/stations', async () => {
    await delay(300)
    return HttpResponse.json<StationsResponse>({
      updatedAt: toKstIso(new Date()),
      dataQuality: 'normal',
      stations: STATIONS,
    })
  }),

  // 충전소 상세. 주소의 stationId로 Mock 충전소를 찾아 충전기별 상태까지 돌려줌
  http.get<{ stationId: string }>('/api/v1/stations/:stationId', async ({ params }) => {
    await delay(300)
    const station = findStationDetail(params.stationId, new Date())
    // 없는 ID면 실제 서버처럼 404로 응답해서 상세 화면의 "찾을 수 없음" 상태를 확인할 수 있게 함
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
]

/**
 * 백엔드에 아직 없는 API(추천 · 길찾기) 핸들러를 만든다. 혼합 모드에서도 Mock으로 응답함.
 * 충전소 목록을 어디서 가져올지(getStations)만 바꿔 끼워서 전체 · 혼합 모드가 같은 핸들러를 쓴다
 */
function createUnimplementedHandlers(getStations: StationSource) {
  return [
    // 추천 충전소. 내 위치와 필터를 받아 시점(지금 · 15분 후 등)마다 Top 3를 만들어 돌려줌
    http.post<never, RecommendationsRequest>('/api/v1/recommendations', async ({ request }) => {
      const { lat, lng, filters } = await request.json()
      const stations = await getStations()
      // 충전소 목록을 못 받았으면 추천을 만들 수 없으니 503 - 추천 시트의 오류 상태로 이어짐
      if (!stations) return HttpResponse.json<ApiErrorBody>(DATA_UNAVAILABLE, { status: 503 })
      await delay(300)
      return HttpResponse.json<RecommendationsResponse>({
        updatedAt: toKstIso(new Date()),
        dataQuality: 'normal',
        results: HORIZONS.map((horizon) =>
          buildRecommendations(stations, { lat, lng }, horizon, filters),
        ),
      })
    }),

    // 길찾기. 출발지와 충전소 ID를 받아 Mock 경로(꺾은선 · 거리 · 시간)를 돌려줌
    http.post<never, RouteRequest, ApiErrorBody | RouteResponse>(
      '/api/v1/routes',
      async ({ request }) => {
        const { origin, stationId } = await request.json()
        const stations = await getStations()
        // 충전소 목록을 못 받았으면 도착지 좌표를 알 수 없으니 503
        if (!stations) return HttpResponse.json(DATA_UNAVAILABLE, { status: 503 })
        await delay(400)
        const station = stations.find((s) => s.stationId === stationId)
        // 목록에 없는 충전소면 404 - 혼합 모드에서는 실제 충전소 ID여야 찾아짐
        if (!station) {
          return HttpResponse.json<ApiErrorBody>(
            { error: { code: 'STATION_NOT_FOUND', message: '충전소를 찾을 수 없습니다.' } },
            { status: 404 },
          )
        }
        const route = buildMockRoute(origin, station)
        // 운영 불가 충전소는 Mock 경로가 null - 404로 응답해서 "경로 없음" 화면을 확인할 수 있게 함
        if (!route) {
          return HttpResponse.json<ApiErrorBody>(
            { error: { code: 'ROUTE_NOT_FOUND', message: '경로를 찾을 수 없습니다.' } },
            { status: 404 },
          )
        }
        return HttpResponse.json<RouteResponse>(route)
      },
    ),
  ]
}

/** 고속도로 휴게소 API - 전체 Mock 모드에서만 씀 */
const serviceAreaHandlers = [
  // 휴게소 목록. Mock 휴게소 전체를 돌려줌
  http.get('/api/v1/service-areas', async () => {
    await delay(300)
    return HttpResponse.json<ServiceAreasResponse>({
      updatedAt: toKstIso(new Date()),
      dataQuality: 'normal',
      serviceAreas: SERVICE_AREAS,
    })
  }),

  // 휴게소 충전기 현황. ?name=휴게소명&direction=up|down 으로 한 방향의 충전기 상태를 돌려줌
  http.get<PathParams, DefaultBodyType, ApiErrorBody | ServiceAreaChargersResponse>(
    '/api/v1/service-areas/chargers',
    async ({ request }) => {
      await delay(300)
      const url = new URL(request.url)
      const name = url.searchParams.get('name')
      const direction = url.searchParams.get('direction')
      // 이름이 없거나 방향이 up/down이 아니면 백엔드(FastAPI)처럼 422로 응답
      if (!name || (direction !== 'up' && direction !== 'down')) {
        return HttpResponse.json<ApiErrorBody>(
          { error: { code: 'VALIDATION_ERROR', message: '요청 형식이 올바르지 않습니다.' } },
          { status: 422 },
        )
      }
      const found = findServiceAreaChargers(name, direction, new Date())
      // 해당 이름 · 방향의 휴게소가 없으면 404
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

/**
 * 혼합 모드용 충전소 목록. MSW를 거치지 않고(bypass) 실제 서버의 /stations를 직접 호출한다.
 * 실제 충전소로 추천을 만들어야 추천 카드 → 상세 · 길찾기가 실제 API로 이어진다.
 * 예측은 아직 전부 null이라 그대로 쓰면 추천이 비어서 기준선으로 채움
 */
async function fetchRealStations(): Promise<Station[] | null> {
  try {
    const response = await fetch(bypass('/api/v1/stations'))
    // 서버 오류(5xx 등)면 null을 돌려서 핸들러가 503으로 응답하게 함
    if (!response.ok) return null
    const { stations }: StationsResponse = await response.json()
    return stations.map(fillMissingPredictions)
  } catch {
    // 연결 자체가 안 되거나 응답이 JSON이 아니면 예외가 남 - 그대로 두면 MSW가 500으로 응답하므로
    // 서버 오류와 똑같이 null을 돌려서 503(DATA_UNAVAILABLE)로 맞춤
    return null
  }
}

/** VITE_USE_MOCK=true - 모든 API를 Mock으로. 추천 · 길찾기도 Mock 충전소 기준 */
export const handlers = [
  ...stationHandlers,
  ...createUnimplementedHandlers(async () => STATIONS),
  ...serviceAreaHandlers,
]

/** VITE_USE_MOCK=partial - 백엔드에 없는 API(추천 · 길찾기)만 Mock, 나머지는 실제 서버로 */
export const partialHandlers = createUnimplementedHandlers(fetchRealStations)
