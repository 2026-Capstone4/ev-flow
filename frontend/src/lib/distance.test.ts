import { describe, expect, it } from 'vitest'
import { getDistanceMeters } from '@/lib/distance'

describe('getDistanceMeters', () => {
  it('같은 좌표면 0', () => {
    const point = { lat: 37.5559, lng: 126.9019 }
    expect(getDistanceMeters(point, point)).toBe(0)
  })

  it('위도 0.01도 차이는 약 1.1km', () => {
    const distance = getDistanceMeters({ lat: 37.55, lng: 126.9 }, { lat: 37.56, lng: 126.9 })
    expect(distance).toBeGreaterThan(1100)
    expect(distance).toBeLessThan(1120)
  })
})
