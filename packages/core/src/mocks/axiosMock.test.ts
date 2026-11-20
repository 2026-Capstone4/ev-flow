import type { AxiosAdapter } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { api } from '../api/client'
import { getApiErrorCode, getHttpStatus, getRetryAfterSeconds } from '../api/errors'
import { fetchRecommendations, fetchStations } from '../api/stations'
import { enableRecommendationsMock } from './axiosMock'
import { STATIONS } from './stations'

/** 마포구 안 출발 위치 (Mock 충전소 근처) */
const MAPO = { lat: 37.5559, lng: 126.9019 }

/** 추천이 아닌 요청이 원래 adapter로 갔는지 보려고 끼우는 가짜 서버 */
const fakeServer: AxiosAdapter = async (config) => ({
  data: { from: 'server' },
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
})

describe('enableRecommendationsMock', () => {
  const originalAdapter = api.defaults.adapter

  beforeEach(() => {
    api.defaults.adapter = fakeServer
  })

  afterEach(() => {
    api.defaults.adapter = originalAdapter
  })

  it('추천 요청은 Mock 충전소로 시점마다 Top 3를 만든다', async () => {
    enableRecommendationsMock(async () => STATIONS)
    const response = await fetchRecommendations(MAPO)
    expect(response.results.length).toBeGreaterThan(0)
    expect(response.results[0].recommendations.length).toBeGreaterThan(0)
  })

  it('추천이 아닌 요청은 원래 adapter(실제 서버)로 보낸다', async () => {
    enableRecommendationsMock(async () => STATIONS)
    expect(await fetchStations()).toEqual({ from: 'server' })
  })

  it('마포구 밖이면 422 OUT_OF_SERVICE_AREA를 axios 오류로 던진다', async () => {
    enableRecommendationsMock(async () => STATIONS)
    const error = await fetchRecommendations({ lat: 37.4979, lng: 127.0276 }).catch((e) => e)
    expect(getHttpStatus(error)).toBe(422)
    expect(getApiErrorCode(error)).toBe('OUT_OF_SERVICE_AREA')
  })

  it('충전소를 못 받으면 503, 분당 10회를 넘으면 429와 Retry-After를 준다', async () => {
    // 충전소 목록이 없으면 기다림 없이 503이라 호출 제한까지 빠르게 채울 수 있음
    enableRecommendationsMock(async () => null)
    for (let i = 0; i < 10; i++) {
      const error = await fetchRecommendations(MAPO).catch((e) => e)
      expect(getApiErrorCode(error)).toBe('DATA_UNAVAILABLE')
    }
    const limited = await fetchRecommendations(MAPO).catch((e) => e)
    expect(getHttpStatus(limited)).toBe(429)
    expect(getApiErrorCode(limited)).toBe('RATE_LIMITED')
    expect(getRetryAfterSeconds(limited)).toBeGreaterThan(0)
  })
})
