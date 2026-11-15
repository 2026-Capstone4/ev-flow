import { describe, expect, it } from 'vitest'
import {
  filterByStationName,
  formatStationIssues,
  formatStationOccupancy,
  getAdminChargerStatusLabel,
  groupChargersByStation,
  sortChargers,
  sortStations,
  summarizeChargers,
  toggleSort,
  type ChargerSortKey,
  type SortDirection,
  type StationSortKey,
} from '@/lib/admin/chargerStatus'
import type { AdminCharger } from '@/types/admin'

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

describe('filterByStationName', () => {
  const list = [
    charger({ stationName: '망원동 공영주차장1' }),
    charger({ stationName: '합정역 EV 충전소' }),
    charger({ stationName: '천안삼거리휴게소(부산방향)' }),
  ]
  const names = (rows: AdminCharger[]) => rows.map((c) => c.stationName)

  it('충전소명에 검색어가 들어간 충전기만 남김', () => {
    expect(names(filterByStationName(list, '망원'))).toEqual(['망원동 공영주차장1'])
  })

  it('띄어쓰기 · 영문 대소문자는 무시', () => {
    expect(names(filterByStationName(list, '망원동공영'))).toEqual(['망원동 공영주차장1'])
    expect(names(filterByStationName(list, 'ev'))).toEqual(['합정역 EV 충전소'])
  })

  it('검색어가 비었거나 공백뿐이면 전체', () => {
    expect(filterByStationName(list, '')).toHaveLength(3)
    expect(filterByStationName(list, '  ')).toHaveLength(3)
  })

  it('맞는 게 없으면 빈 배열', () => {
    expect(filterByStationName(list, '강남')).toEqual([])
  })
})

describe('groupChargersByStation', () => {
  const stations = groupChargersByStation([
    charger({ stationId: 'A', status: 'charging', statUpdatedAt: '2026-11-14T14:00:00+09:00' }),
    charger({ stationId: 'A', status: 'available', statUpdatedAt: '2026-11-14T14:05:00+09:00' }),
    charger({ stationId: 'A', status: 'maintenance', statUpdatedAt: null }),
    charger({ stationId: 'A', status: 'charging', statUpdatedAt: '2026-11-14T13:50:00+09:00' }),
    charger({ stationId: 'B', status: 'unknown', statUpdatedAt: null }),
  ])
  const byId = (id: string) => stations.find((station) => station.stationId === id)

  it('충전소마다 한 줄, 현재 이용률은 충전 중 ÷ (사용 가능 + 충전 중)', () => {
    expect(stations).toHaveLength(2)
    expect(byId('A')?.chargerCount).toBe(4)
    expect(byId('A')?.occupancy).toEqual({ charging: 2, usable: 3, rate: 2 / 3 })
    expect(byId('B')?.occupancy).toEqual({ charging: 0, usable: 0, rate: null })
  })

  it('고장(운영 중지 · 점검) · 확인 불가 대수와 가장 최근 수신 시각', () => {
    expect(byId('A')).toMatchObject({
      faultCount: 1,
      unknownCount: 0,
      statUpdatedAt: '2026-11-14T14:05:00+09:00',
    })
    expect(byId('B')).toMatchObject({ faultCount: 0, unknownCount: 1, statUpdatedAt: null })
  })
})

describe('formatStationOccupancy', () => {
  it('비율과 대수를 함께, 쓸 수 있는 충전기가 없으면 대시', () => {
    expect(formatStationOccupancy({ charging: 2, usable: 4, rate: 0.5 })).toBe('50% (2/4대)')
    expect(formatStationOccupancy({ charging: 0, usable: 0, rate: null })).toBe('—')
  })
})

describe('formatStationIssues', () => {
  it('0대인 항목은 빼고, 이상이 없으면 null', () => {
    expect(formatStationIssues({ faultCount: 1, unknownCount: 2 })).toBe(
      '점검 · 중지 1 · 확인 불가 2',
    )
    expect(formatStationIssues({ faultCount: 0, unknownCount: 1 })).toBe('확인 불가 1')
    expect(formatStationIssues({ faultCount: 0, unknownCount: 0 })).toBeNull()
  })
})

describe('sortStations', () => {
  const list = groupChargersByStation([
    charger({ stationId: 'X', stationName: '가', status: 'available' }),
    charger({ stationId: 'X', stationName: '가', chargerId: '02', status: 'charging' }),
    charger({ stationId: 'Y', stationName: '나', status: 'charging' }),
    charger({ stationId: 'Y', stationName: '나', chargerId: '02', status: 'unknown' }),
    charger({ stationId: 'Z', stationName: '다', status: 'stopped' }),
    charger({ stationId: 'Z', stationName: '다', chargerId: '02', status: 'unknown' }),
  ])
  const sortBy = (key: StationSortKey, direction: SortDirection) =>
    sortStations(list, { key, direction }).map((station) => station.stationName)

  it('현재 이용률은 방향대로, 쓸 수 있는 충전기가 없는 충전소는 어느 방향이든 맨 아래', () => {
    // 나 100% · 가 50% · 다 값 없음
    expect(sortBy('current', 'desc')).toEqual(['나', '가', '다'])
    expect(sortBy('current', 'asc')).toEqual(['가', '나', '다'])
  })

  it('상태 asc는 이상(고장 + 확인 불가) 많은 순, desc는 반대', () => {
    // 다 2대 · 나 1대 · 가 0대
    expect(sortBy('status', 'asc')).toEqual(['다', '나', '가'])
    expect(sortBy('status', 'desc')).toEqual(['가', '나', '다'])
  })

  it('충전소명은 가나다, desc는 역순', () => {
    expect(sortBy('name', 'asc')).toEqual(['가', '나', '다'])
    expect(sortBy('name', 'desc')).toEqual(['다', '나', '가'])
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

describe('toggleSort', () => {
  it('같은 기준을 다시 누르면 방향만 뒤집힘', () => {
    expect(toggleSort({ key: 'name', direction: 'asc' }, 'name')).toEqual({
      key: 'name',
      direction: 'desc',
    })
  })

  it('다른 기준을 누르면 그 기준의 기본 방향 (이용률은 높은 순)', () => {
    expect(toggleSort({ key: 'status', direction: 'desc' }, 'occupancy')).toEqual({
      key: 'occupancy',
      direction: 'desc',
    })
  })
})
