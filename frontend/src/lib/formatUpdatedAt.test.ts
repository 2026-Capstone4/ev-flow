import { describe, expect, it } from 'vitest'
import { formatClock, formatElapsed } from '@/lib/formatUpdatedAt'

describe('formatClock', () => {
  it('시:분을 두 자리로 표기함', () => {
    expect(formatClock(new Date(2026, 9, 27, 9, 5))).toBe('09:05')
  })
})

describe('formatElapsed', () => {
  const base = new Date(2026, 9, 27, 14, 5)

  it('1분 미만이면 방금', () => {
    expect(formatElapsed(base, new Date(base.getTime() + 30_000))).toBe('방금')
  })

  it('분 · 시간 단위로 표기함', () => {
    expect(formatElapsed(base, new Date(base.getTime() + 60_000))).toBe('1분 전')
    expect(formatElapsed(base, new Date(base.getTime() + 2 * 3_600_000))).toBe('2시간 전')
  })
})
