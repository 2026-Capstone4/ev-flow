import { describe, expect, it } from 'vitest'
import {
  formatStatusSummary,
  getAvailabilityTone,
  groupChargersByOperator,
  parseDirection,
} from '@/lib/serviceArea'
import type { ServiceAreaCharger } from '@/types/serviceArea'

describe('parseDirection', () => {
  it('down만 하행, 나머지는 상행', () => {
    expect(parseDirection('down')).toBe('down')
    expect(parseDirection('up')).toBe('up')
    expect(parseDirection(null)).toBe('up')
  })
})

describe('formatStatusSummary', () => {
  it('사용 가능을 빼고 0이 아닌 상태만 이어 붙임', () => {
    expect(
      formatStatusSummary({ available: 3, charging: 1, stopped: 0, maintenance: 1, unknown: 0 }),
    ).toBe('충전 중 1 · 점검 중 1')
  })

  it('모두 사용 가능이면 빈 문자열', () => {
    expect(
      formatStatusSummary({ available: 2, charging: 0, stopped: 0, maintenance: 0, unknown: 0 }),
    ).toBe('')
  })
})

describe('getAvailabilityTone', () => {
  it('사용 가능 2대 이상 · 1대 · 0대를 구분함', () => {
    expect(getAvailabilityTone(2, 4, 0)).toBe('free')
    expect(getAvailabilityTone(1, 2, 0)).toBe('normal')
    expect(getAvailabilityTone(0, 2, 0)).toBe('busy')
  })

  it('상태를 아는 충전기가 없으면 unknown', () => {
    expect(getAvailabilityTone(0, 3, 3)).toBe('unknown')
  })
})

describe('groupChargersByOperator', () => {
  const charger = (operator: string, stationId: string, chargerId: string): ServiceAreaCharger => ({
    operator,
    stationId,
    chargerId,
    status: 'available',
    connectorTypes: ['dc_combo'],
    capacityKw: 100,
    chargingStartedAt: null,
  })

  it('같은 운영기관의 다른 충전소는 한 운영기관 안에서 충전소별로 나눔', () => {
    const groups = groupChargersByOperator([
      charger('기후에너지환경부', 'ME178010', '01'),
      charger('기후에너지환경부', 'ME21A307', '01'),
      charger('SK일렉링크', 'ST441325', '01'),
      charger('기후에너지환경부', 'ME178010', '02'),
    ])
    expect(groups.map((g) => g.operator)).toEqual(['기후에너지환경부', 'SK일렉링크'])
    expect(
      groups[0].stations.map((s) => [s.stationId, s.chargers.map((c) => c.chargerId)]),
    ).toEqual([
      ['ME178010', ['01', '02']],
      ['ME21A307', ['01']],
    ])
  })

  it('운영기관명 앞뒤 공백은 다듬어서 같은 운영기관으로 묶음', () => {
    const groups = groupChargersByOperator([
      charger('SK시그넷 ', 'SGMAC044', '01'),
      charger('SK시그넷', 'SGMAC045', '01'),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].operator).toBe('SK시그넷')
  })
})
