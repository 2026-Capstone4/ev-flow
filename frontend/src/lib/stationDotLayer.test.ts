import { describe, expect, it } from 'vitest'
import { findNearestIndex } from '@/lib/stationDotLayer'

describe('findNearestIndex', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 100, y: 100 },
  ]

  it('반지름 안의 점 중 가장 가까운 점을 고름', () => {
    expect(findNearestIndex(points, 8, 1, 16)).toBe(1)
    expect(findNearestIndex(points, 2, 1, 16)).toBe(0)
  })

  it('반지름 안에 점이 없으면 -1', () => {
    expect(findNearestIndex(points, 50, 50, 16)).toBe(-1)
    expect(findNearestIndex([], 0, 0, 16)).toBe(-1)
  })
})
