import { describe, expect, it } from 'vitest'
import { getCollectionHealth } from '@/lib/admin/collection'
import type { CollectionTarget } from '@/types/admin'

function target(overrides: Partial<CollectionTarget>): CollectionTarget {
  return {
    target: 'city',
    zscode: '11440',
    lastRunAt: '2026-11-14T14:05:00+09:00',
    lastStatus: 'success',
    lastSuccessAt: '2026-11-14T14:05:00+09:00',
    failedRunsToday: 0,
    lastApiLatencyMs: 800,
    averageApiLatencyMsToday: 900,
    ...overrides,
  }
}

const now = new Date('2026-11-14T14:10:00+09:00')

describe('getCollectionHealth', () => {
  it('모든 대상이 최근에 성공했으면 정상', () => {
    expect(getCollectionHealth([target({}), target({ target: 'service_area' })], now)).toBe(
      'normal',
    )
  })

  it('최근 성공은 있지만 마지막 실행이 실패면 일부 실패', () => {
    expect(getCollectionHealth([target({}), target({ lastStatus: 'partial' })], now)).toBe(
      'partial',
    )
  })

  it('한 대상이라도 20분 넘게 성공이 없으면 끊김이 우선', () => {
    const stale = target({ lastStatus: 'failed', lastSuccessAt: '2026-11-14T13:00:00+09:00' })
    expect(getCollectionHealth([target({ lastStatus: 'partial' }), stale], now)).toBe('stopped')
  })

  it('대상이 없으면 null', () => {
    expect(getCollectionHealth([], now)).toBeNull()
  })
})
