import { describe, expect, it } from 'vitest'
import {
  formatPercent,
  formatPeriodRange,
  getAdminChargerStatusLabel,
  getCollectionHealth,
  getLoginErrorMessage,
  getOccupancyLevel,
  isStale,
  sortChargers,
  summarizeChargers,
  toggleChargerSort,
  type ChargerSortKey,
  type SortDirection,
} from '@/lib/admin'
import type { AdminCharger, CollectionTarget } from '@/types/admin'

function charger(overrides: Partial<AdminCharger>): AdminCharger {
  return {
    region: 'city',
    stationId: 'S1',
    stationName: '가 충전소',
    chargerId: '01',
    status: 'available',
    stat: '2',
    todayOccupancyRate: 0.5,
    statUpdatedAt: '2026-11-14T14:00:00+09:00',
    ...overrides,
  }
}

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

describe('getOccupancyLevel', () => {
  it('80% 이상은 high, 55% 이상은 medium, 그 아래는 low', () => {
    expect(getOccupancyLevel(0.8)).toBe('high')
    expect(getOccupancyLevel(0.55)).toBe('medium')
    expect(getOccupancyLevel(0.549)).toBe('low')
  })

  it('관측이 없으면 null', () => {
    expect(getOccupancyLevel(null)).toBeNull()
  })
})

describe('formatPercent', () => {
  it('비율을 반올림한 퍼센트로 표기하고 값이 없으면 대시', () => {
    expect(formatPercent(0.072)).toBe('7%')
    expect(formatPercent(0.072, 1)).toBe('7.2%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(null)).toBe('—')
  })
})

describe('getAdminChargerStatusLabel', () => {
  it('확인 불가는 원본 코드로 통신 이상 · 상태 미확인을 나눔', () => {
    expect(getAdminChargerStatusLabel({ status: 'unknown', stat: '1' })).toBe('통신 이상')
    expect(getAdminChargerStatusLabel({ status: 'unknown', stat: '9' })).toBe('상태 미확인')
    expect(getAdminChargerStatusLabel({ status: 'unknown', stat: '2' })).toBe('확인 불가')
    expect(getAdminChargerStatusLabel({ status: 'maintenance', stat: '5' })).toBe('점검 중')
  })
})

describe('summarizeChargers', () => {
  it('구분별 · 고장 수를 세고, 이용률 분모에서 운영 불가 · 확인 불가를 뺌', () => {
    const summary = summarizeChargers([
      charger({ status: 'charging' }),
      charger({ status: 'available' }),
      charger({ status: 'available', region: 'service_area' }),
      charger({ status: 'charging', region: 'service_area' }),
      charger({ status: 'stopped' }),
      charger({ status: 'maintenance', region: 'service_area' }),
      charger({ status: 'unknown' }),
    ])
    expect(summary).toEqual({
      total: 7,
      cityCount: 4,
      serviceAreaCount: 3,
      faultCount: 2,
      cityFaultCount: 1,
      serviceAreaFaultCount: 1,
      unknownCount: 1,
      currentOccupancyRate: 0.5,
    })
  })

  it('사용 가능 · 충전 중이 하나도 없으면 이용률은 null', () => {
    expect(summarizeChargers([charger({ status: 'unknown' })]).currentOccupancyRate).toBeNull()
  })
})

describe('sortChargers', () => {
  const list = [
    charger({ stationName: '나', status: 'available', todayOccupancyRate: 0.2 }),
    charger({ stationName: '다', status: 'unknown', todayOccupancyRate: null }),
    charger({ stationName: '가', status: 'charging', todayOccupancyRate: 0.9 }),
    charger({ stationName: '가', chargerId: '10', status: 'maintenance', todayOccupancyRate: 0 }),
    charger({ stationName: '가', chargerId: '2', status: 'maintenance', todayOccupancyRate: 0 }),
  ]
  const names = (rows: AdminCharger[]) => rows.map((c) => `${c.stationName}${c.chargerId}`)

  const sortBy = (key: ChargerSortKey, direction: SortDirection) =>
    names(sortChargers(list, { key, direction }))

  it('상태 asc는 확인 불가 → 운영 중지 · 점검 → 충전 중 → 사용 가능, desc는 반대', () => {
    expect(sortBy('status', 'asc')).toEqual(['다01', '가2', '가10', '가01', '나01'])
    expect(sortBy('status', 'desc')).toEqual(['나01', '가01', '가2', '가10', '다01'])
  })

  it('충전소명은 가나다(충전기 번호는 숫자로 비교), desc는 전체 역순', () => {
    expect(sortBy('name', 'asc')).toEqual(['가01', '가2', '가10', '나01', '다01'])
    expect(sortBy('name', 'desc')).toEqual(['다01', '나01', '가10', '가2', '가01'])
  })

  it('이용률은 방향대로 정렬하고 관측 없는 충전기는 어느 방향이든 맨 아래', () => {
    expect(sortBy('occupancy', 'desc')).toEqual(['가01', '나01', '가2', '가10', '다01'])
    expect(sortBy('occupancy', 'asc')).toEqual(['가2', '가10', '나01', '가01', '다01'])
  })

  it('원본 배열은 바꾸지 않음', () => {
    const before = names(list)
    sortBy('name', 'desc')
    expect(names(list)).toEqual(before)
  })
})

describe('toggleChargerSort', () => {
  it('같은 기준을 다시 누르면 방향만 뒤집힘', () => {
    expect(toggleChargerSort({ key: 'name', direction: 'asc' }, 'name')).toEqual({
      key: 'name',
      direction: 'desc',
    })
  })

  it('다른 기준을 누르면 그 기준의 기본 방향 (이용률은 높은 순)', () => {
    expect(toggleChargerSort({ key: 'status', direction: 'desc' }, 'occupancy')).toEqual({
      key: 'occupancy',
      direction: 'desc',
    })
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

describe('getLoginErrorMessage', () => {
  it('잠금은 Retry-After를 초 · 분으로 안내함', () => {
    expect(getLoginErrorMessage('LOGIN_LOCKED', 45)).toContain('45초 후')
    expect(getLoginErrorMessage('LOGIN_LOCKED', 90)).toContain('2분 후')
    expect(getLoginErrorMessage('LOGIN_LOCKED', null)).toContain('잠시 후')
  })

  it('알 수 없는 오류 · 네트워크 오류는 다시 시도 안내', () => {
    expect(getLoginErrorMessage(null, null)).toContain('잠시 후 다시 시도')
    expect(getLoginErrorMessage('INVALID_CREDENTIALS', null)).toContain('올바르지 않습니다')
  })
})

describe('isStale', () => {
  it('20분 넘게 지났거나 시각이 없으면 true', () => {
    expect(isStale('2026-11-14T13:50:00+09:00', now)).toBe(false)
    expect(isStale('2026-11-14T13:49:00+09:00', now)).toBe(true)
    expect(isStale(null, now)).toBe(true)
  })
})

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
