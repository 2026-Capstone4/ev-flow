import { describe, expect, it } from 'vitest'
import { toLocateFailure } from '@/lib/geolocation'

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
