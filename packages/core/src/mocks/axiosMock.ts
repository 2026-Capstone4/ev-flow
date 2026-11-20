import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { fetchStations } from '../api/stations'
import { api } from '../api/client'
import type { RecommendationsRequest } from '../types/station'
import {
  createMockRateLimit,
  respondRecommendations,
  type MockResponse,
  type StationSource,
} from './mockApi'
import { fillMissingPredictions } from './stations'

/**
 * 실제 서버의 충전소 목록에 기준선 예측을 채워 추천 후보로 씀
 * 실제 충전소로 추천을 만들어야 추천 카드 → 상세 · 길찾기가 실제 API로 이어짐
 */
const fetchRealStations: StationSource = async () => {
  try {
    const { stations } = await fetchStations()
    return stations.map(fillMissingPredictions)
  } catch {
    // 서버 오류 · 연결 실패는 모두 null → 503(DATA_UNAVAILABLE)로 맞춤
    return null
  }
}

/** 추천 요청인지. baseURL을 뺀 경로로 비교함 (fetchRecommendations가 '/recommendations'로 부름) */
function isRecommendationsRequest(config: InternalAxiosRequestConfig) {
  return config.method === 'post' && config.url === '/recommendations'
}

/** Mock 응답을 axios 응답으로 바꿈. 2xx가 아니면 실제 서버 오류처럼 AxiosError를 던짐 */
function toAxiosResponse(mock: MockResponse, config: InternalAxiosRequestConfig): AxiosResponse {
  const response: AxiosResponse = {
    data: mock.body,
    status: mock.status,
    statusText: '',
    headers: new AxiosHeaders(mock.headers),
    config,
    request: null,
  }
  // 성공이면 그대로 돌려줌
  if (mock.status >= 200 && mock.status < 300) return response
  // 4xx · 5xx는 화면의 오류 처리(getApiErrorCode · getRetryAfterSeconds)가 읽는 모양 그대로 던짐
  throw new AxiosError(
    `Request failed with status code ${mock.status}`,
    mock.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
    config,
    null,
    response,
  )
}

/**
 * 공용 api 인스턴스에 추천 Mock을 끼움 (앱 혼합 모드). 추천만 Mock으로 답하고 나머지 요청은 원래대로 서버로 보냄
 * 웹은 MSW를 쓰므로 부르지 않음. 첫 요청 전에 한 번 부름
 * getStations는 테스트에서 실제 서버 대신 넣을 때만 넘김
 */
export function enableRecommendationsMock(getStations: StationSource = fetchRealStations) {
  // 원래 adapter(RN은 xhr, 테스트는 http)를 꺼내 두고, 추천이 아닌 요청은 그대로 넘김
  const passThrough = axios.getAdapter(api.defaults.adapter)
  const checkRateLimit = createMockRateLimit()
  const adapter: AxiosAdapter = async (config) => {
    // 추천이 아니면 실제 서버로
    if (!isRecommendationsRequest(config)) return passThrough(config)
    // 요청 본문은 axios가 이미 JSON 문자열로 바꿔 둔 상태라 다시 풀어 씀
    const request: RecommendationsRequest =
      typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    const mock = await respondRecommendations(request, getStations, checkRateLimit)
    return toAxiosResponse(mock, config)
  }
  api.defaults.adapter = adapter
}
