import { describe, expect, it } from 'vitest'
import { formatChargerSpec, formatChargingElapsed } from '@/lib/charger'

describe('formatChargerSpec', () => {
  it('커넥터가 여러 개면 /로 이어 표기함', () => {
    expect(formatChargerSpec(['dc_combo'], 100)).toBe('DC콤보 · 100kW')
    expect(formatChargerSpec(['dc_chademo', 'ac3'], 50)).toBe('DC차데모/AC3상 · 50kW')
  })
})

describe('formatChargingElapsed', () => {
  const now = new Date('2026-11-03T14:30:00+09:00')

  it('시작 시각부터 경과한 분을 표기함', () => {
    expect(formatChargingElapsed('2026-11-03T14:07:00+09:00', now)).toBe('23분째')
  })

  it('1시간이 넘으면 시간과 분으로 표기함', () => {
    expect(formatChargingElapsed('2026-11-03T13:25:00+09:00', now)).toBe('1시간 5분째')
    expect(formatChargingElapsed('2026-11-03T13:30:00+09:00', now)).toBe('1시간째')
  })

  it('충전 중이 아니면 null', () => {
    expect(formatChargingElapsed(null, now)).toBeNull()
  })
})
