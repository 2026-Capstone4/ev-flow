import { describe, expect, it } from 'vitest'
import { getRecommendStep } from './useRecommendationOrigin'

const ORIGIN = { lat: 37.5535, lng: 126.9135 }
// 위도 0.001도 ≈ 111m
const NEAR = { lat: ORIGIN.lat + 0.004, lng: ORIGIN.lng } // 약 445m
const FAR = { lat: ORIGIN.lat + 0.005, lng: ORIGIN.lng } // 약 556m
const MIN = 60_000
const NOW = 1_000_000_000

describe('getRecommendStep', () => {
  it('아직 안 불렀으면 부르지 않음 (쿼리가 처음 열 때 부름)', () => {
    expect(getRecommendStep(NOW, null, ORIGIN, FAR)).toEqual({ call: false, checkInMs: null })
  })

  it('5분이 지나면 제자리여도 부름', () => {
    expect(getRecommendStep(NOW, NOW - 5 * MIN, ORIGIN, ORIGIN)).toEqual({ call: true })
  })

  it('제자리면 5분이 되는 때 다시 봄', () => {
    expect(getRecommendStep(NOW, NOW - MIN, ORIGIN, NEAR)).toEqual({
      call: false,
      checkInMs: 4 * MIN,
    })
  })

  it('500m 넘게 움직이고 2분 지났으면 부름', () => {
    expect(getRecommendStep(NOW, NOW - 2 * MIN, ORIGIN, FAR)).toEqual({ call: true })
  })

  it('500m 넘게 움직였어도 2분 전이면 2분이 되는 때 다시 봄', () => {
    expect(getRecommendStep(NOW, NOW - 30_000, ORIGIN, FAR)).toEqual({
      call: false,
      checkInMs: 90_000,
    })
  })

  it('시연 위치에서 부른 뒤 처음 잰 위치가 500m 넘게 떨어지면 2분 전이어도 바로 부름', () => {
    expect(getRecommendStep(NOW, NOW - 5_000, ORIGIN, FAR, true)).toEqual({ call: true })
  })

  it('첫 추천 응답 전이어도 처음 잰 위치가 멀면 바로 부름', () => {
    expect(getRecommendStep(NOW, null, ORIGIN, FAR, true)).toEqual({ call: true })
  })

  it('처음 잰 위치가 시연 위치에서 500m 안이면 평소 규칙대로 기다림', () => {
    expect(getRecommendStep(NOW, NOW - MIN, ORIGIN, NEAR, true)).toEqual({
      call: false,
      checkInMs: 4 * MIN,
    })
  })
})
