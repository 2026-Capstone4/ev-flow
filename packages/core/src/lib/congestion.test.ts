import { describe, expect, it } from 'vitest'
import { formatWaitRange, formatWaitTime, getCongestionLabel, getWaitNote } from './congestion'

describe('getCongestionLabel', () => {
  it('3단계 혼잡도를 한국어로 표기함', () => {
    expect(getCongestionLabel('low')).toBe('여유')
    expect(getCongestionLabel('medium')).toBe('보통')
    expect(getCongestionLabel('high')).toBe('혼잡')
  })

  it('현재 혼잡도의 예외 상태를 구분해 표기함', () => {
    expect(getCongestionLabel('unknown')).toBe('확인 불가')
    expect(getCongestionLabel('unavailable')).toBe('운영 불가')
  })

  it('예측값이 없으면 조회 불가로 표기함', () => {
    expect(getCongestionLabel(null)).toBe('조회 불가')
  })
})

describe('formatWaitRange', () => {
  it('상세 화면용으로 접두어 없이 표기함', () => {
    expect(formatWaitRange(5, 15)).toBe('5~15분')
    expect(formatWaitRange(0, 0)).toBe('대기 거의 없음')
    expect(formatWaitRange(null, null)).toBeNull()
  })

  it('혼잡인데 P90이 0이면 0분이라고 말하지 않음', () => {
    expect(formatWaitRange(0, 0, 'high')).toBe('대기 예측 어려움')
    expect(formatWaitRange(0, 0, 'low')).toBe('대기 거의 없음')
    expect(formatWaitRange(15, 30, 'high')).toBe('15~30분')
  })

  it('P50과 P90이 같으면 한 번만 씀', () => {
    expect(formatWaitRange(5, 5)).toBe('5분')
    expect(formatWaitRange(5, 5, 'high')).toBe('5분')
  })
})

describe('formatWaitTime', () => {
  it('P50~P90 구간으로 표기함', () => {
    expect(formatWaitTime(5, 15)).toBe('대기 5~15분')
  })

  it('P50과 P90이 같으면 대기 5분처럼 한 번만 씀', () => {
    expect(formatWaitTime(5, 5)).toBe('대기 5분')
  })

  it('P90이 0이면 대기 거의 없음으로 표기함', () => {
    expect(formatWaitTime(0, 0)).toBe('대기 거의 없음')
  })

  it('혼잡인데 P90이 0이면 대기 예측 어려움으로 표기함', () => {
    expect(formatWaitTime(0, 0, 'high')).toBe('대기 예측 어려움')
  })

  it('값이 없으면 null', () => {
    expect(formatWaitTime(null, null)).toBeNull()
  })
})

describe('getWaitNote', () => {
  it('혼잡인데 P90이 0이면 다시 확인하도록 안내함', () => {
    expect(getWaitNote(0, 0, 'high')).toEqual([
      '빈 충전기가 없을 수 있어요',
      '도착 전에 다시 확인하는 게 좋아요',
    ])
  })

  it('P90이 0이면 확률로 안내함', () => {
    expect(getWaitNote(0, 0, 'medium')).toEqual(['바로 충전할 가능성이 높아요'])
  })

  it('범위가 있거나 값이 없으면 null', () => {
    expect(getWaitNote(5, 15, 'high')).toBeNull()
    expect(getWaitNote(null, null, 'high')).toBeNull()
  })
})
