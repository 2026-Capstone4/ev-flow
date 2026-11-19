import { describe, expect, it } from 'vitest'
import { formatWaitTime, getRetryWaitText } from './rateLimit'

describe('formatWaitTime', () => {
  it('1분 미만은 초', () => {
    expect(formatWaitTime(30)).toBe('30초')
  })

  it('1분 이상은 올림한 분', () => {
    expect(formatWaitTime(60)).toBe('1분')
    expect(formatWaitTime(61)).toBe('2분')
  })
})

describe('getRetryWaitText', () => {
  it('Retry-After가 있으면 남은 시간', () => {
    expect(getRetryWaitText(30)).toBe('30초 후')
  })

  it('Retry-After가 없으면 잠시 후', () => {
    expect(getRetryWaitText(null)).toBe('잠시 후')
  })
})
