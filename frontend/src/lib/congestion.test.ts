import { describe, expect, it } from 'vitest'
import { formatWaitTime, getCongestionLabel } from '@/lib/congestion'

describe('getCongestionLabel', () => {
  it('3단계 혼잡도를 한국어로 표기함', () => {
    expect(getCongestionLabel('low')).toBe('여유')
    expect(getCongestionLabel('medium')).toBe('보통')
    expect(getCongestionLabel('high')).toBe('혼잡')
  })

  it('예측값이 없으면 예측 없음으로 표기함', () => {
    expect(getCongestionLabel(null)).toBe('예측 없음')
  })
})

describe('formatWaitTime', () => {
  it('P50~P90 구간으로 표기함', () => {
    expect(formatWaitTime(5, 15)).toBe('대기 5~15분')
  })

  it('P90이 0이면 대기 없음으로 표기함', () => {
    expect(formatWaitTime(0, 0)).toBe('대기 없음')
  })

  it('값이 없으면 null', () => {
    expect(formatWaitTime(null, null)).toBeNull()
  })
})
