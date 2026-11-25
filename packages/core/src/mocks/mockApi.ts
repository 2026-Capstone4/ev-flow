import { isInMapo } from '../lib/coverage'
import { HORIZONS } from '../lib/horizon'
import type { ApiErrorBody } from '../types/api'
import type { RecommendationsRequest, RecommendationsResponse, Station } from '../types/station'
import { buildRecommendations } from './recommendations'
import { toKstIso } from './stations'

/**
 * 웹 MSW 핸들러와 앱 axios adapter가 같이 쓰는 Mock 응답 모양
 * 상태 코드 · 본문 · 헤더만 담고, 실제 응답 객체로 바꾸는 건 각자 함 (MSW는 HttpResponse, 앱은 axios 응답)
 */
export type MockResponse<T = unknown> = {
  status: number
  body: T
  /** 헤더 이름은 소문자로 둠. axios는 받은 헤더를 소문자 이름으로 읽음 (getRetryAfterSeconds) */
  headers?: Record<string, string>
}

/**
 * 추천에 쓸 충전소 목록을 넘겨주는 함수 모양
 * 웹 Mock은 Mock 충전소를 돌려줌. 못 가져오면 null
 */
export type StationSource = () => Promise<Station[] | null>

/** 충전소 목록을 못 가져왔을 때 돌려주는 503 응답 본문 (API 명세의 DATA_UNAVAILABLE) */
export const DATA_UNAVAILABLE: ApiErrorBody = {
  error: { code: 'DATA_UNAVAILABLE', message: '충전 상태 데이터를 불러올 수 없습니다.' },
}

/** 추천 · 길찾기를 합쳐 이 시간 안에 이만큼 넘게 부르면 429 RATE_LIMITED (화면 확인용, 실제 기준은 미정) */
export const MOCK_RATE_LIMIT = { maxCalls: 10, windowMs: 60_000 }

/** 실제 서버처럼 조금 늦게 응답하도록 기다림 */
export function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/**
 * 호출 제한 검사 함수를 만든다. 호출 시각은 만든 함수마다 따로 기억함 (새로고침 · 앱 재시작하면 초기화)
 * 검사 함수는 한도를 넘었으면 429 응답을, 아니면 이번 호출을 기록하고 null을 돌려줌
 * Retry-After는 가장 오래된 호출이 기준 시간 밖으로 나갈 때까지 남은 초
 */
export function createMockRateLimit(limit = MOCK_RATE_LIMIT) {
  const recentCalls: number[] = []
  return function checkMockRateLimit(): MockResponse<ApiErrorBody> | null {
    const now = Date.now()
    // 기준 시간보다 오래된 호출은 세지 않도록 앞에서부터 버림
    while (recentCalls.length > 0 && recentCalls[0] <= now - limit.windowMs) recentCalls.shift()
    // 한도를 채웠으면 기록하지 않고 429 - 추천 시트 · 길찾기 화면의 호출 제한 안내로 이어짐
    if (recentCalls.length >= limit.maxCalls) {
      const retryAfter = Math.ceil((recentCalls[0] + limit.windowMs - now) / 1000)
      return {
        status: 429,
        body: {
          error: { code: 'RATE_LIMITED', message: '요청이 많아 잠시 후 다시 시도해 주세요.' },
        },
        headers: { 'retry-after': String(retryAfter) },
      }
    }
    recentCalls.push(now)
    return null
  }
}

/**
 * 추천 API(POST /recommendations) Mock 응답을 만든다
 * 충전소 목록을 어디서 가져올지(getStations)와 호출 제한 검사만 바꿔 끼움
 */
export async function respondRecommendations(
  { lat, lng, filters }: RecommendationsRequest,
  getStations: StationSource,
  checkRateLimit: () => MockResponse<ApiErrorBody> | null,
): Promise<MockResponse<ApiErrorBody | RecommendationsResponse>> {
  const limited = checkRateLimit()
  // 호출 제한을 넘었으면 추천을 만들지 않고 429 그대로
  if (limited) return limited
  // 출발 위치가 마포구 밖이면 실제 서버처럼 422 - 추천 시트에 마포구만 지원한다는 안내가 뜸
  if (!isInMapo({ lat, lng })) {
    await wait(300)
    return {
      status: 422,
      body: {
        error: {
          code: 'OUT_OF_SERVICE_AREA',
          message: '현재 충전소 추천 기능은 마포구만 지원해요',
        },
      },
    }
  }
  const stations = await getStations()
  // 충전소 목록을 못 받았으면 추천을 만들 수 없으니 503 - 추천 시트의 오류 상태로 이어짐
  if (!stations) return { status: 503, body: DATA_UNAVAILABLE }
  await wait(300)
  return {
    status: 200,
    body: {
      updatedAt: toKstIso(new Date()),
      dataQuality: 'normal',
      results: HORIZONS.map((horizon) =>
        buildRecommendations(stations, { lat, lng }, horizon, filters),
      ),
    },
  }
}
