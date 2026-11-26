import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { getRecommendState } from './useMapHomeData'

// 합정역 근처(마포구 안) · 강남역(마포구 밖)
const MAPO = { lat: 37.5495, lng: 126.9139 }
const GANGNAM = { lat: 37.4979, lng: 127.0276 }

function responseError(status: number, code: string) {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('error', undefined, config, undefined, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { error: { code, message: '' } },
  })
}

describe('getRecommendState', () => {
  it('422 OUT_OF_SERVICE_AREA 오류면 out_of_area', () => {
    expect(getRecommendState('error', responseError(422, 'OUT_OF_SERVICE_AREA'), 0, MAPO)).toBe(
      'out_of_area',
    )
  })

  it('429 RATE_LIMITED 오류면 rate_limited', () => {
    expect(getRecommendState('error', responseError(429, 'RATE_LIMITED'), 0, MAPO)).toBe(
      'rate_limited',
    )
  })

  it('다른 오류는 error 그대로', () => {
    expect(getRecommendState('error', responseError(503, 'DATA_UNAVAILABLE'), 0, MAPO)).toBe(
      'error',
    )
  })

  it('마지막 정상값이 있으면(ready) 오류 코드와 상관없이 그대로', () => {
    expect(getRecommendState('ready', responseError(422, 'OUT_OF_SERVICE_AREA'), 0, MAPO)).toBe(
      'ready',
    )
  })

  it('마포구 밖에서 15 · 30분이 비어 있으면 out_of_area', () => {
    expect(getRecommendState('empty', null, 15, GANGNAM)).toBe('out_of_area')
    expect(getRecommendState('empty', null, 30, GANGNAM)).toBe('out_of_area')
  })

  it('마포구 밖이어도 지금(0분)이 비어 있으면 empty', () => {
    expect(getRecommendState('empty', null, 0, GANGNAM)).toBe('empty')
  })

  it('마포구 안에서 15 · 30분이 비어 있으면 empty', () => {
    expect(getRecommendState('empty', null, 15, MAPO)).toBe('empty')
  })

  it('마포구 밖 15 · 30분도 불러오는 중이면 loading', () => {
    expect(getRecommendState('loading', null, 30, GANGNAM)).toBe('loading')
  })
})
