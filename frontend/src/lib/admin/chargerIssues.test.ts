import { describe, expect, it } from 'vitest'
import {
  countChargerIssues,
  countIssueStations,
  getChargerIssueKind,
  listChargerIssues,
} from '@/lib/admin/chargerIssues'
import type { AdminCharger } from '@/types/admin'

function charger(overrides: Partial<AdminCharger>): AdminCharger {
  return {
    region: 'city',
    stationId: 'S1',
    stationName: '가 충전소',
    chargerId: '01',
    status: 'unknown',
    stat: '9',
    unstable: false,
    todayOccupancyRate: null,
    statUpdatedAt: '2026-11-22T14:00:00+09:00',
    ...overrides,
  }
}

describe('getChargerIssueKind', () => {
  it('확인 불가가 아니면 상태 이상이 아님', () => {
    expect(getChargerIssueKind(charger({ status: 'available', stat: '2' }))).toBeNull()
    expect(getChargerIssueKind(charger({ status: 'stopped', stat: '4' }))).toBeNull()
  })

  it('원본 코드로 통신 이상 · 상태 미확인 · 기타를 나눔', () => {
    expect(getChargerIssueKind(charger({ stat: '1' }))).toBe('communication')
    expect(getChargerIssueKind(charger({ stat: '9' }))).toBe('unconfirmed')
    expect(getChargerIssueKind(charger({ stat: null }))).toBe('other')
    expect(getChargerIssueKind(charger({ stat: '0' }))).toBe('other')
  })

  it('불안정 충전기는 코드가 9여도 불안정으로만 셈', () => {
    expect(getChargerIssueKind(charger({ stat: '9', unstable: true }))).toBe('unstable')
    // 지금 사용 가능이면 불안정 충전기여도 상태 이상이 아님
    expect(getChargerIssueKind(charger({ status: 'available', stat: '2', unstable: true }))).toBe(
      null,
    )
  })
})

describe('listChargerIssues', () => {
  it('종류 순서 → 충전소 이름 → 충전기 번호로 정렬하고 상태를 아는 충전기는 뺌', () => {
    const issues = listChargerIssues([
      charger({ stationName: '나', chargerId: '02', stat: '9' }),
      charger({ stationName: '가', chargerId: '01', stat: '9', unstable: true }),
      charger({ stationName: '나', chargerId: '01', stat: '1' }),
      charger({ stationName: '가', chargerId: '03', stat: '9' }),
      charger({ stationName: '다', status: 'charging', stat: '3' }),
    ])
    expect(issues.map((i) => `${i.kind}:${i.charger.stationName}${i.charger.chargerId}`)).toEqual([
      'communication:나01',
      'unconfirmed:가03',
      'unconfirmed:나02',
      'unstable:가01',
    ])
    expect(countChargerIssues(issues)).toEqual({
      communication: 1,
      unconfirmed: 2,
      other: 0,
      unstable: 1,
    })
  })

  it('충전소 수는 지역 · 충전소 ID로 셈', () => {
    const issues = listChargerIssues([
      charger({ stationId: 'S1', chargerId: '01' }),
      charger({ stationId: 'S1', chargerId: '02' }),
      charger({ stationId: 'S1', region: 'service_area' }),
    ])
    expect(countIssueStations(issues)).toBe(2)
  })
})
