import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { getRecommendState } from './useMapHomeData'

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
    expect(getRecommendState('error', responseError(422, 'OUT_OF_SERVICE_AREA'))).toBe(
      'out_of_area',
    )
  })

  it('429 RATE_LIMITED 오류면 rate_limited', () => {
    expect(getRecommendState('error', responseError(429, 'RATE_LIMITED'))).toBe('rate_limited')
  })

  it('다른 오류는 error 그대로', () => {
    expect(getRecommendState('error', responseError(503, 'DATA_UNAVAILABLE'))).toBe('error')
  })

  it('마지막 정상값이 있으면(ready) 오류 코드와 상관없이 그대로', () => {
    expect(getRecommendState('ready', responseError(422, 'OUT_OF_SERVICE_AREA'))).toBe('ready')
  })
})
