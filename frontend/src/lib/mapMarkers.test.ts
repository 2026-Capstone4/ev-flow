import { describe, expect, it } from 'vitest'
import {
  isDotStation,
  isHiddenZoom,
  isInView,
  toMarkerKey,
  toViewBounds,
  toZIndex,
} from '@/lib/mapMarkers'
import type { Station } from '@/types/station'

function station(overrides: Partial<Station> = {}): Station {
  return {
    stationId: 'S1',
    name: '충전소',
    lat: 37.55,
    lng: 126.9,
    availableChargers: 1,
    totalChargers: 2,
    congestion: 'medium',
    // 기본은 서울(마포 밖) 충전소. 마포는 테스트에서 따로 켬
    predictionAvailable: false,
    ...overrides,
  } as Station
}

describe('isHiddenZoom', () => {
  it('줌 11 이하면 숨김, 12부터 보임', () => {
    expect(isHiddenZoom(11)).toBe(true)
    expect(isHiddenZoom(12)).toBe(false)
  })
})

describe('isDotStation', () => {
  it('줌 13 이하의 서울 충전소는 점, 14부터 숫자', () => {
    expect(isDotStation(13, station(), false)).toBe(true)
    expect(isDotStation(14, station(), false)).toBe(false)
  })

  it('점 구간에서도 마포 · 추천 충전소는 숫자', () => {
    expect(isDotStation(12, station({ predictionAvailable: true }), false)).toBe(false)
    expect(isDotStation(12, station(), true)).toBe(false)
  })
})

describe('toZIndex', () => {
  it('추천 > 마포 > 나머지 순서로 위에 올림', () => {
    const recommended = toZIndex(station(), true)
    const mapo = toZIndex(station({ predictionAvailable: true }), false)
    const others = toZIndex(station(), false)
    expect(recommended).toBeGreaterThan(mapo)
    expect(mapo).toBeGreaterThan(others)
  })

  it('마포 충전소도 추천이면 추천 순서', () => {
    expect(toZIndex(station({ predictionAvailable: true }), true)).toBe(toZIndex(station(), true))
  })
})

describe('toMarkerKey', () => {
  it('대수 · 혼잡도 · 추천 여부가 같으면 이름 · 좌표가 달라도 같은 키', () => {
    expect(toMarkerKey(station(), false)).toBe(
      toMarkerKey(station({ name: '다른 이름', lat: 37.6 }), false),
    )
  })

  it('대수 · 혼잡도 · 추천 여부 중 하나라도 바뀌면 다른 키', () => {
    const key = toMarkerKey(station(), false)
    expect(toMarkerKey(station({ availableChargers: 2 }), false)).not.toBe(key)
    expect(toMarkerKey(station({ congestion: 'high' }), false)).not.toBe(key)
    expect(toMarkerKey(station(), true)).not.toBe(key)
  })
})

describe('toViewBounds · isInView', () => {
  it('화면 범위에 위아래 · 좌우 30%씩 여유를 더함', () => {
    expect(toViewBounds({ lat: 37, lng: 126 }, { lat: 38, lng: 127 })).toEqual({
      south: 36.7,
      west: 125.7,
      north: 38.3,
      east: 127.3,
    })
  })

  it('여유 범위 안(경계 포함)이면 안, 밖이면 밖', () => {
    const view = { south: 37, west: 126, north: 38, east: 127 }
    expect(isInView(station({ lat: 37, lng: 127 }), view)).toBe(true)
    expect(isInView(station({ lat: 38.01, lng: 126.5 }), view)).toBe(false)
    expect(isInView(station({ lat: 37.5, lng: 125.99 }), view)).toBe(false)
  })
})
