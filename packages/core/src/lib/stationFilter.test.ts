import { describe, expect, it } from 'vitest'
import {
  countActiveFilters,
  DEFAULT_FILTERS,
  isDefaultFilters,
  matchesFilters,
} from './stationFilter'
import type { Charger, CurrentCongestion, Prediction, Station } from '../types/station'

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
    predictionAvailable: true,
  }
}

function prediction(horizonMinutes: 15 | 30, congestion: Prediction['congestion']): Prediction {
  return {
    horizonMinutes,
    congestion,
    waitTimeP50Minutes: null,
    waitTimeP90Minutes: null,
    source: 'model',
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
    expect(matchesFilters(station([combo200Charging]), DEFAULT_FILTERS, 0)).toBe(true)
  })

  it('커넥터는 하나라도 맞으면 남김', () => {
    const multi: Charger = { ...combo50Available, connectorTypes: ['dc_chademo', 'ac3'] }
    const filters = { ...DEFAULT_FILTERS, connectorTypes: ['ac3' as const, 'nacs' as const] }
    expect(matchesFilters(station([multi]), filters, 0)).toBe(true)
    expect(matchesFilters(station([combo50Available]), filters, 0)).toBe(false)
  })

  it('조건을 같은 충전기 하나가 모두 만족해야 함 (명세 예시)', () => {
    // DC콤보 50kW 사용 가능 + DC콤보 200kW 충전 중 → 100kW · 사용 가능만이면 제외
    const filters = {
      connectorTypes: ['dc_combo' as const],
      minCapacityKw: 100 as const,
      statusFilter: 'available_only' as const,
    }
    expect(matchesFilters(station([combo50Available, combo200Charging]), filters, 0)).toBe(false)
  })

  it('혼잡 제외는 지금 출발이면 현재 혼잡 · 운영 불가를 빼고 확인 불가는 남김', () => {
    const filters = { ...DEFAULT_FILTERS, statusFilter: 'exclude_high' as const }
    expect(matchesFilters(station([combo200Charging], 'high'), filters, 0)).toBe(false)
    expect(matchesFilters(station([combo200Charging], 'unavailable'), filters, 0)).toBe(false)
    expect(matchesFilters(station([combo200Charging], 'unknown'), filters, 0)).toBe(true)
  })

  it('혼잡 제외는 15 · 30분 후면 그 시점 예측 혼잡도로 판정', () => {
    const filters = { ...DEFAULT_FILTERS, statusFilter: 'exclude_high' as const }
    // 지금은 혼잡이지만 15분 후 여유 예측 → 남김, 30분 후 혼잡 예측 → 뺌
    const busyNow = {
      ...station([combo200Charging], 'high'),
      predictions: [prediction(15, 'low'), prediction(30, 'high')],
    }
    expect(matchesFilters(busyNow, filters, 0)).toBe(false)
    expect(matchesFilters(busyNow, filters, 15)).toBe(true)
    expect(matchesFilters(busyNow, filters, 30)).toBe(false)
  })

  it('혼잡 제외는 예측이 없으면 남기고, 지금 운영 불가면 예측과 상관없이 뺌', () => {
    const filters = { ...DEFAULT_FILTERS, statusFilter: 'exclude_high' as const }
    expect(matchesFilters(station([combo200Charging], 'high'), filters, 15)).toBe(true)
    const closedNow = {
      ...station([combo200Charging], 'unavailable'),
      predictions: [prediction(15, 'low')],
    }
    expect(matchesFilters(closedNow, filters, 15)).toBe(false)
  })

  it('혼잡 제외가 아니면 시점과 상관없이 같은 결과', () => {
    const busyLater = { ...station([combo200Charging]), predictions: [prediction(30, 'high')] }
    expect(matchesFilters(busyLater, DEFAULT_FILTERS, 30)).toBe(true)
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
