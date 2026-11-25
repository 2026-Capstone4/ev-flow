import { describe, expect, it } from 'vitest'
import { formatPeriodRange, getOccupancyLevel, summarizeMissing } from '@/lib/admin/charts'

describe('getOccupancyLevel', () => {
  it('80% 이상은 high, 60% 이상은 medium, 그 아래는 low', () => {
    expect(getOccupancyLevel(0.8)).toBe('high')
    expect(getOccupancyLevel(0.6)).toBe('medium')
    expect(getOccupancyLevel(0.599)).toBe('low')
  })

  it('관측이 없으면 null', () => {
    expect(getOccupancyLevel(null)).toBeNull()
  })
})

describe('formatPeriodRange', () => {
  it('기간이 하루면 날짜 하나, 여러 날이면 범위', () => {
    expect(formatPeriodRange('2026-11-14T00:00:00+09:00', '2026-11-14T14:05:00+09:00')).toBe(
      '11/14',
    )
    expect(formatPeriodRange('2026-10-24T00:00:00+09:00', '2026-10-30T14:05:00+09:00')).toBe(
      '10/24 ~ 10/30',
    )
  })
})

describe('summarizeMissing', () => {
  const bucket = (expectedCount: number, missingCount: number) => ({
    bucket: 0,
    label: '0시',
    expectedCount,
    matchedCount: expectedCount - missingCount,
    missingCount,
    missingRate: expectedCount ? missingCount / expectedCount : null,
    failedRuns: 0,
  })

  it('칸별 건수를 더해 전체 결측률을 구함', () => {
    expect(summarizeMissing([bucket(100, 2), bucket(300, 6)])).toEqual({
      missingCount: 8,
      expectedCount: 400,
      missingRate: 0.02,
    })
  })

  it('실행이 없으면 결측률 null', () => {
    expect(summarizeMissing([bucket(0, 0)]).missingRate).toBeNull()
  })
})
