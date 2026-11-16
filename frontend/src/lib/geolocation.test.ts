import { describe, expect, it } from 'vitest'
import { isLocateFailure, toLocateFailure } from '@/lib/geolocation'

describe('isLocateFailure', () => {
  it('실패 이유 문자열이면 true', () => {
    expect(isLocateFailure('denied')).toBe(true)
    expect(isLocateFailure('out-of-area')).toBe(true)
  })

  it('예상 못 한 오류 · 다른 문자열 · 객체 속성 이름은 false', () => {
    expect(isLocateFailure(new Error('boom'))).toBe(false)
    expect(isLocateFailure('boom')).toBe(false)
    expect(isLocateFailure('toString')).toBe(false)
    expect(isLocateFailure(undefined)).toBe(false)
  })
})

describe('toLocateFailure', () => {
  it('브라우저 오류 코드를 실패 이유로 바꿈', () => {
    expect(toLocateFailure(1)).toBe('denied')
    expect(toLocateFailure(2)).toBe('unavailable')
    expect(toLocateFailure(3)).toBe('timeout')
  })

  it('알 수 없는 코드는 위치를 못 찾은 것으로 봄', () => {
    expect(toLocateFailure(99)).toBe('unavailable')
  })
})
