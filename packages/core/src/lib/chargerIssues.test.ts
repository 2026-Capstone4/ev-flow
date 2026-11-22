import { describe, expect, it } from 'vitest'
import {
  countIssuesByDistrict,
  findNearestDistrict,
  getDistrict,
  groupChargerIssues,
  isUnstableCharger,
  UNSTABLE_CHARGER_KEYS,
} from './chargerIssues'
import type { Charger, ChargerStatus, Station } from '../types/station'

function charger(chargerId: string, status: ChargerStatus): Charger {
  return { chargerId, status, connectorTypes: ['dc_combo'], capacityKw: 100 }
}

function station(
  stationId: string,
  name: string,
  chargers: Charger[],
  extra: Partial<Station> = {},
): Station {
  return {
    stationId,
    name,
    address: '서울특별시 마포구 월드컵로 240',
    lat: 37.55,
    lng: 126.9,
    operator: '테스트',
    totalChargers: chargers.length,
    availableChargers: 0,
    slowChargerCount: 0,
    midChargerCount: 0,
    congestion: 'medium',
    dataQuality: 'normal',
    chargers,
    predictions: [],
    predictionAvailable: true,
    ...extra,
  }
}

describe('isUnstableCharger', () => {
  it('목록에 있는 충전소 · 충전기 조합만 불안정으로 봄', () => {
    expect(UNSTABLE_CHARGER_KEYS.size).toBe(17)
    expect(isUnstableCharger('ME19A601', '21')).toBe(true)
    expect(isUnstableCharger('ME19A601', '01')).toBe(false)
  })
})

describe('getDistrict', () => {
  it('주소에서 구 이름을 뽑음', () => {
    expect(getDistrict('서울특별시 마포구 월드컵로 240')).toBe('마포구')
    expect(getDistrict('서울 중구 세종대로 110')).toBe('중구')
    expect(getDistrict('경기도 고양시')).toBeNull()
  })
})

describe('groupChargerIssues', () => {
  it('지금 확인 불가인 충전기만 담고, 불안정 충전기는 불안정 쪽에만 넣음', () => {
    const result = groupChargerIssues([
      station('ME19A601', '망원동', [
        charger('21', 'unknown'),
        charger('22', 'available'),
        charger('01', 'unknown'),
        charger('02', 'charging'),
      ]),
    ])
    expect(result.unstable[0].chargers.map((c) => c.chargerId)).toEqual(['21'])
    expect(result.unknown[0].chargers.map((c) => c.chargerId)).toEqual(['01'])
    expect(result.unstableCount).toBe(1)
    expect(result.unknownCount).toBe(1)
  })

  it('해당 충전기가 없는 충전소는 빼고, 미확인은 대수가 많은 곳부터', () => {
    const result = groupChargerIssues([
      station('A', '가', [charger('01', 'unknown')]),
      station('B', '나', [charger('01', 'unknown'), charger('02', 'unknown')]),
      station('C', '다', [charger('01', 'available')]),
    ])
    expect(result.unknown.map((s) => s.stationId)).toEqual(['B', 'A'])
    expect(result.unstable).toEqual([])
  })
})

describe('countIssuesByDistrict', () => {
  it('구마다 확인 불가 대수를 세고, 0인 구도 이름순으로 넣음', () => {
    const result = countIssuesByDistrict([
      station('A', '가', [charger('01', 'unknown')], { address: '서울특별시 송파구 올림픽로 1' }),
      station('B', '나', [charger('01', 'unknown'), charger('02', 'unknown')]),
      station('C', '다', [charger('01', 'available')], { address: '서울특별시 강남구 테헤란로 1' }),
    ])
    expect(result).toEqual([
      { district: '강남구', count: 0 },
      { district: '마포구', count: 2 },
      { district: '송파구', count: 1 },
    ])
  })
})

describe('findNearestDistrict', () => {
  it('가장 가까운 충전소의 구를 돌려줌', () => {
    const stations = [
      station('A', '가', [], { lat: 37.556, lng: 126.91 }),
      station('B', '나', [], { address: '서울특별시 송파구 올림픽로 1', lat: 37.51, lng: 127.1 }),
    ]
    expect(findNearestDistrict(stations, { lat: 37.5, lng: 127.09 })).toBe('송파구')
    expect(findNearestDistrict([], { lat: 37.5, lng: 127.09 })).toBeNull()
  })
})
