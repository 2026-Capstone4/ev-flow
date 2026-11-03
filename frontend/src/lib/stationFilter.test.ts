import { describe, expect, it } from 'vitest'
import {
  countActiveFilters,
  DEFAULT_FILTERS,
  isDefaultFilters,
  matchesFilters,
} from '@/lib/stationFilter'
import type { Charger, CurrentCongestion, Station } from '@/types/station'

function station(chargers: Charger[], congestion: CurrentCongestion = 'medium'): Station {
  return {
    stationId: 'S1',
    name: '테스트 충전소',
    address: '서울 마포구',
    lat: 37.55,
    lng: 126.9,
    operator: '테스트',
    totalChargers: chargers.length,
    availableChargers: chargers.filter((c) => c.status === 'available').length,
    slowChargerCount: 0,
    midChargerCount: 0,
    congestion,
    dataQuality: 'normal',
    chargers,
    predictions: [],
  }
}

const combo50Available: Charger = {
  chargerId: '01',
  status: 'available',
  connectorTypes: ['dc_combo'],
  capacityKw: 50,
}
const combo200Charging: Charger = {
  chargerId: '02',
  status: 'charging',
  connectorTypes: ['dc_combo'],
  capacityKw: 200,
}

describe('matchesFilters', () => {
  it('기본 필터면 모두 남김', () => {
    expect(matchesFilters(station([combo200Charging]), DEFAULT_FILTERS)).toBe(true)
  })

  it('커넥터는 하나라도 맞으면 남김', () => {
    const multi: Charger = { ...combo50Available, connectorTypes: ['dc_chademo', 'ac3'] }
    const filters = { ...DEFAULT_FILTERS, connectorTypes: ['ac3' as const, 'nacs' as const] }
    expect(matchesFilters(station([multi]), filters)).toBe(true)
    expect(matchesFilters(station([combo50Available]), filters)).toBe(false)
  })

  it('조건을 같은 충전기 하나가 모두 만족해야 함 (명세 예시)', () => {
    // DC콤보 50kW 사용 가능 + DC콤보 200kW 충전 중 → 100kW · 사용 가능만이면 제외
    const filters = {
      connectorTypes: ['dc_combo' as const],
      minCapacityKw: 100 as const,
      statusFilter: 'available_only' as const,
    }
    expect(matchesFilters(station([combo50Available, combo200Charging]), filters)).toBe(false)
  })

  it('혼잡 제외는 현재 혼잡 · 운영 불가를 빼고 확인 불가는 남김', () => {
    const filters = { ...DEFAULT_FILTERS, statusFilter: 'exclude_high' as const }
    expect(matchesFilters(station([combo200Charging], 'high'), filters)).toBe(false)
    expect(matchesFilters(station([combo200Charging], 'unavailable'), filters)).toBe(false)
    expect(matchesFilters(station([combo200Charging], 'unknown'), filters)).toBe(true)
  })
})

describe('countActiveFilters · isDefaultFilters', () => {
  it('커넥터는 고른 개수만큼, 용량 · 상태는 하나씩 셈', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0)
    expect(
      countActiveFilters({
        connectorTypes: ['dc_combo', 'nacs'],
        minCapacityKw: 100,
        statusFilter: 'exclude_high',
      }),
    ).toBe(4)
  })

  it('하나라도 바뀌면 기본값이 아님', () => {
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true)
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, minCapacityKw: 200 })).toBe(false)
  })
})
