import { describe, expect, it } from 'vitest'
import { formatPercent, isStale } from '@/lib/admin/common'

const now = new Date('2026-11-14T14:10:00+09:00')

describe('formatPercent', () => {
  it('비율을 반올림한 퍼센트로 표기하고 값이 없으면 대시', () => {
    expect(formatPercent(0.072)).toBe('7%')
    expect(formatPercent(0.072, 1)).toBe('7.2%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(null)).toBe('—')
  })
})

describe('isStale', () => {
  it('20분 넘게 지났거나 시각이 없으면 true', () => {
    expect(isStale('2026-11-14T13:50:00+09:00', now)).toBe(false)
    expect(isStale('2026-11-14T13:49:00+09:00', now)).toBe(true)
    expect(isStale(null, now)).toBe(true)
  })
})
