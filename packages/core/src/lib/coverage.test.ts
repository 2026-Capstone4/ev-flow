import { describe, expect, it } from 'vitest'
import { DEMO_USER_LOCATION } from './constants'
import { isInMapo, isPointInRing } from './coverage'

describe('isPointInRing', () => {
  // 경도 0~10, 위도 0~10 정사각형 (GeoJSON 순서 [경도, 위도])
  const square = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ]

  it('안쪽 점은 true', () => {
    expect(isPointInRing({ lat: 5, lng: 5 }, square)).toBe(true)
  })

  it('바깥 점은 false', () => {
    expect(isPointInRing({ lat: 5, lng: 15 }, square)).toBe(false)
    expect(isPointInRing({ lat: -1, lng: 5 }, square)).toBe(false)
  })
})

describe('isInMapo', () => {
  it('시연 위치(합정역 근처) · 마포구청은 마포구 안', () => {
    expect(isInMapo(DEMO_USER_LOCATION)).toBe(true)
    expect(isInMapo({ lat: 37.5663, lng: 126.9019 })).toBe(true)
  })

  it('강남역 · 서울시청 · 부산은 마포구 밖', () => {
    expect(isInMapo({ lat: 37.4979, lng: 127.0276 })).toBe(false)
    expect(isInMapo({ lat: 37.5663, lng: 126.9779 })).toBe(false)
    expect(isInMapo({ lat: 35.1796, lng: 129.0756 })).toBe(false)
  })
})
