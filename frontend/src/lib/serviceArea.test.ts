import { describe, expect, it } from 'vitest'
import { formatStatusSummary, getAvailabilityTone, parseDirection } from '@/lib/serviceArea'

describe('parseDirection', () => {
  it('down만 하행, 나머지는 상행', () => {
    expect(parseDirection('down')).toBe('down')
    expect(parseDirection('up')).toBe('up')
    expect(parseDirection(null)).toBe('up')
  })
})

describe('formatStatusSummary', () => {
  it('사용 가능을 빼고 0이 아닌 상태만 이어 붙임', () => {
    expect(
      formatStatusSummary({ available: 3, charging: 1, stopped: 0, maintenance: 1, unknown: 0 }),
    ).toBe('충전 중 1 · 점검 중 1')
  })

  it('모두 사용 가능이면 빈 문자열', () => {
    expect(
      formatStatusSummary({ available: 2, charging: 0, stopped: 0, maintenance: 0, unknown: 0 }),
    ).toBe('')
  })
})

describe('getAvailabilityTone', () => {
  it('사용 가능 2대 이상 · 1대 · 0대를 구분함', () => {
    expect(getAvailabilityTone(2, 4, 0)).toBe('free')
    expect(getAvailabilityTone(1, 2, 0)).toBe('normal')
    expect(getAvailabilityTone(0, 2, 0)).toBe('busy')
  })

  it('상태를 아는 충전기가 없으면 unknown', () => {
    expect(getAvailabilityTone(0, 3, 3)).toBe('unknown')
  })
})
