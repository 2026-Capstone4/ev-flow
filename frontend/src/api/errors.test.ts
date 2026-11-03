import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { getApiErrorCode, isRetryableError } from '@/api/errors'

function responseError(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('error', undefined, config, undefined, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  })
}

describe('getApiErrorCode', () => {
  it('공통 에러 형식이면 code를 꺼냄', () => {
    const error = responseError(404, { error: { code: 'STATION_NOT_FOUND', message: '' } })
    expect(getApiErrorCode(error)).toBe('STATION_NOT_FOUND')
  })

  it('형식이 다른 응답(Nginx HTML)이나 일반 에러면 null', () => {
    expect(getApiErrorCode(responseError(502, '<html>'))).toBeNull()
    expect(getApiErrorCode(new Error('network'))).toBeNull()
  })
})

describe('isRetryableError', () => {
  it('4xx는 재시도하지 않음', () => {
    expect(isRetryableError(responseError(404, null))).toBe(false)
    expect(isRetryableError(responseError(422, null))).toBe(false)
  })

  it('5xx · 응답 없는 네트워크 오류는 재시도함', () => {
    expect(isRetryableError(responseError(503, null))).toBe(true)
    expect(isRetryableError(new AxiosError('timeout'))).toBe(true)
  })
})
