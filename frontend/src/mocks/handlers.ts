import {
  delay,
  http,
  HttpResponse,
  type DefaultBodyType,
  type JsonBodyType,
  type PathParams,
} from 'msw'
import {
  createMockRateLimit,
  respondRecommendations,
  type MockResponse,
  type StationSource,
} from '@ev-flow/core/mocks/mockApi'
import { buildMockRoute } from '@ev-flow/core/mocks/routes'
import { findServiceAreaChargers, SERVICE_AREAS } from '@ev-flow/core/mocks/serviceAreas'
import { findStationDetail, STATIONS, toKstIso } from '@ev-flow/core/mocks/stations'
import {
  buildAdminChargers,
  buildCollectionTargets,
  buildMissingStats,
  buildUtilization,
  MOCK_ADMIN,
  MOCK_LOCK_SECONDS,
  MOCK_MAX_LOGIN_FAILURES,
  MOCK_SESSION_MS,
} from '@/mocks/data/admin'
import type { AdminPeriod, AdminRegion, AuthSession, LoginRequest } from '@/types/admin'
import type { ApiErrorBody } from '@ev-flow/core/types/api'
import type {
  ServiceAreaChargersResponse,
  ServiceAreasResponse,
} from '@ev-flow/core/types/serviceArea'
import type {
  RecommendationsRequest,
  RouteRequest,
  RouteResponse,
  StationDetailResponse,
  StationsResponse,
} from '@ev-flow/core/types/station'

/** 공용 Mock 응답(@ev-flow/core/mocks/mockApi)을 MSW 응답으로 바꿈 */
function toHttpResponse<T extends JsonBodyType>(mock: MockResponse<T>) {
  return HttpResponse.json<T>(mock.body, { status: mock.status, headers: mock.headers })
}

/** 충전소 목록 · 상세 API */
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

/** 추천 · 길찾기를 합쳐 세는 호출 제한 (화면 확인용). 새로고침하면 초기화됨 */
const checkMockRateLimit = createMockRateLimit()

/**
 * 추천 API 핸들러를 만든다.
 * 응답 만들기는 앱과 같이 쓰는 core 함수에 맡기고, 충전소 목록을 어디서 가져올지(getStations)만 바꿔 끼움
 */
function createRecommendationHandler(getStations: StationSource) {
  // 추천 충전소. 내 위치와 필터를 받아 시점(지금 · 15분 후 등)마다 Top 3를 만들어 돌려줌
  return http.post<never, RecommendationsRequest>('/api/v1/recommendations', async ({ request }) =>
    toHttpResponse(
      await respondRecommendations(await request.json(), getStations, checkMockRateLimit),
    ),
  )
}

/**
 * 길찾기 Mock (실제 서버는 POST /routes, #117)
 * 출발지와 충전소 ID를 받아 Mock 경로(꺾은선 · 거리 · 시간)를 돌려줌
 */
const routeHandler = http.post<never, RouteRequest, ApiErrorBody | RouteResponse>(
  '/api/v1/routes',
  async ({ request }) => {
    const { origin, stationId } = await request.json()
    const limited = checkMockRateLimit()
    // 호출 제한을 넘었으면 경로를 만들지 않고 429 그대로
    if (limited) return toHttpResponse(limited)
    await delay(400)
    const station = STATIONS.find((s) => s.stationId === stationId)
    // Mock 충전소 목록에 없는 ID면 404
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
)

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

/** Mock 로그인 쿠키 이름. 값은 만료 시각(ms) — 실제 서버의 HttpOnly 토큰 쿠키 대신 씀 */
const MOCK_SESSION_COOKIE = 'ev_flow_mock_admin'

/** 연속으로 틀린 횟수 · 잠금 해제 시각. 새로고침하면 초기화됨 */
const loginGuard = { failures: 0, lockedUntil: 0 }

const UNAUTHORIZED: ApiErrorBody = {
  error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
}

/** 쿠키의 만료 시각이 아직 안 지났으면 로그인 응답을, 아니면 null을 돌려줌 */
function readMockSession(cookies: Record<string, string>): AuthSession | null {
  const expiresAt = Number(cookies[MOCK_SESSION_COOKIE])
  // 쿠키가 없거나(로그인 안 함 · 로그아웃) 만료 시각이 지났으면 로그인 안 된 상태
  if (!expiresAt || expiresAt <= Date.now()) return null
  return {
    admin: { loginId: MOCK_ADMIN.loginId, name: MOCK_ADMIN.name },
    expiresAt: toKstIso(new Date(expiresAt)),
  }
}

/** 쿼리스트링의 region · period. 명세에 없는 값이면 null */
function readDashboardParams(request: Request) {
  const url = new URL(request.url)
  const region = url.searchParams.get('region') ?? 'all'
  const period = url.searchParams.get('period') ?? 'day'
  // 명세의 값(all · city · service_area / day · week)이 아니면 FastAPI처럼 422로 응답하도록 null
  if (!['all', 'city', 'service_area'].includes(region) || !['day', 'week'].includes(period)) {
    return null
  }
  return { region: region as AdminRegion, period: period as AdminPeriod }
}

/**
 * 대시보드 요청이 로그인된 상태인지 판단하는 함수 모양.
 * 지금은 전체 Mock의 Mock 쿠키 확인만 있음
 */
type SessionCheck = (cookies: Record<string, string>) => Promise<boolean>

/** 전체 Mock용 - Mock 로그인 쿠키가 살아 있으면 로그인된 상태 */
const checkMockSession: SessionCheck = async (cookies) => readMockSession(cookies) !== null

/**
 * 로그인이 필요한 운영자 API 핸들러를 만든다.
 * 로그인 안 됐으면 401, region · period가 잘못됐으면 422, 둘 다 통과하면 build 결과를 돌려줌
 */
function adminGet<T extends DefaultBodyType>(
  path: string,
  isLoggedIn: SessionCheck,
  build: (params: { region: AdminRegion; period: AdminPeriod }, now: Date) => T,
) {
  return http.get(`/api/v1${path}`, async ({ request, cookies }) => {
    await delay(300)
    // 로그인 안 됐거나 만료 → 401. 프론트는 로그인 화면으로 이동
    if (!(await isLoggedIn(cookies))) {
      return HttpResponse.json<ApiErrorBody>(UNAUTHORIZED, { status: 401 })
    }
    const params = readDashboardParams(request)
    // 쿼리 값이 명세와 다르면 422
    if (!params) {
      return HttpResponse.json<ApiErrorBody>(
        { error: { code: 'VALIDATION_ERROR', message: '요청 형식이 올바르지 않습니다.' } },
        { status: 422 },
      )
    }
    return HttpResponse.json(build(params, new Date()))
  })
}

/** 운영자 로그인 · 로그아웃 · 로그인 상태 API */
const authHandlers = [
  // 로그인. 아이디 · 비밀번호가 맞으면 만료 시각을 담은 쿠키를 내려줌
  http.post<never, LoginRequest>('/api/v1/auth/login', async ({ request }) => {
    await delay(400)
    const { loginId, password } = await request.json()
    const now = Date.now()
    // 잠금 중이면 남은 시간을 Retry-After로 알려 주고 429
    if (loginGuard.lockedUntil > now) {
      return HttpResponse.json<ApiErrorBody>(
        {
          error: {
            code: 'LOGIN_LOCKED',
            message: '로그인 시도가 많아 잠시 후 다시 시도해 주세요.',
          },
        },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((loginGuard.lockedUntil - now) / 1000)) },
        },
      )
    }
    // 아이디나 비밀번호가 비어 있으면 서버 검증 실패와 같게 422
    if (!loginId || !password) {
      return HttpResponse.json<ApiErrorBody>(
        { error: { code: 'VALIDATION_ERROR', message: '아이디와 비밀번호를 입력해 주세요.' } },
        { status: 422 },
      )
    }
    // 계정이 틀리면 실패 횟수를 올리고 401. 정해진 횟수에 닿으면 다음 요청부터 잠금
    if (loginId !== MOCK_ADMIN.loginId || password !== MOCK_ADMIN.password) {
      loginGuard.failures += 1
      // 연속 실패가 한도에 닿으면 잠금 시작, 횟수는 다시 0부터
      if (loginGuard.failures >= MOCK_MAX_LOGIN_FAILURES) {
        loginGuard.lockedUntil = now + MOCK_LOCK_SECONDS * 1000
        loginGuard.failures = 0
      }
      return HttpResponse.json<ApiErrorBody>(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '아이디 또는 비밀번호가 올바르지 않습니다.',
          },
        },
        { status: 401 },
      )
    }
    loginGuard.failures = 0
    const expiresAt = now + MOCK_SESSION_MS
    return HttpResponse.json<AuthSession>(
      {
        admin: { loginId: MOCK_ADMIN.loginId, name: MOCK_ADMIN.name },
        expiresAt: toKstIso(new Date(expiresAt)),
      },
      {
        // MSW가 이 헤더를 document.cookie로 옮겨 줌 (HttpOnly는 흉내 낼 수 없어 뺌)
        headers: {
          'Set-Cookie': `${MOCK_SESSION_COOKIE}=${expiresAt}; Path=/; Max-Age=${MOCK_SESSION_MS / 1000}; SameSite=Strict`,
        },
      },
    )
  }),

  // 로그아웃. 쿠키를 지우고 204
  http.post('/api/v1/auth/logout', async () => {
    await delay(200)
    return new HttpResponse(null, {
      status: 204,
      headers: { 'Set-Cookie': `${MOCK_SESSION_COOKIE}=; Path=/; Max-Age=0` },
    })
  }),

  // 로그인 상태. 쿠키가 살아 있으면 로그인 응답과 같은 모양, 아니면 401
  http.get<PathParams, DefaultBodyType, ApiErrorBody | AuthSession>(
    '/api/v1/auth/me',
    async ({ cookies }) => {
      await delay(200)
      const session = readMockSession(cookies)
      // 로그인 안 됐거나 만료 → 401. 대시보드 진입 시 로그인 화면으로 보냄
      if (!session) return HttpResponse.json<ApiErrorBody>(UNAUTHORIZED, { status: 401 })
      return HttpResponse.json<AuthSession>(session)
    },
  ),
]

/**
 * 운영자 대시보드 10~13번 (이용률 · 충전기 목록 · 수집 상태 · 결측 현황) (실제 서버는 백엔드 #72)
 */
const dashboardHandlers = [
  adminGet('/admin/utilization', checkMockSession, ({ region, period }, now) =>
    buildUtilization(region, period, now),
  ),
  adminGet('/admin/chargers', checkMockSession, ({ region }, now) => ({
    updatedAt: toKstIso(now),
    chargers: buildAdminChargers(region, now),
  })),
  adminGet('/admin/collection-status', checkMockSession, ({ region }, now) => ({
    targets: buildCollectionTargets(region, now),
  })),
  adminGet('/admin/missing-stats', checkMockSession, ({ region, period }, now) =>
    buildMissingStats(region, period, now),
  ),
]

/** VITE_USE_MOCK=true - 모든 API를 Mock으로. 추천 · 길찾기도 Mock 충전소 기준 */
export const handlers = [
  ...stationHandlers,
  createRecommendationHandler(async () => STATIONS),
  routeHandler,
  ...serviceAreaHandlers,
  ...authHandlers,
  ...dashboardHandlers,
]
