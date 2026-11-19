import { describe, expect, it } from 'vitest'
import { findPrediction, getHorizonLabel, getHorizonWhen, parseHorizon } from './horizon'
import type { Prediction } from '../types/station'

describe('parseHorizon', () => {
  it('0(지금) · 15 · 30만 받음', () => {
    expect(parseHorizon('0')).toBe(0)
    expect(parseHorizon('15')).toBe(15)
    expect(parseHorizon('30')).toBe(30)
  })

  it('없거나 잘못된 값이면 기본값 0(지금 출발)', () => {
    expect(parseHorizon(null)).toBe(0)
    expect(parseHorizon('')).toBe(0)
    expect(parseHorizon('45')).toBe(0)
    expect(parseHorizon('abc')).toBe(0)
  })

  it('서비스에서 뺀 60분은 기본값 0(지금 출발)', () => {
    expect(parseHorizon('60')).toBe(0)
  })
})

describe('getHorizonLabel · getHorizonWhen', () => {
  it('0분은 지금으로 표시', () => {
    expect(getHorizonLabel(0)).toBe('지금 출발')
    expect(getHorizonWhen(0)).toBe('지금')
  })

  it('나머지는 N분 후', () => {
    expect(getHorizonLabel(15)).toBe('15분 후')
    expect(getHorizonWhen(30)).toBe('30분 후')
  })
})

describe('findPrediction', () => {
  const p15: Prediction = {
    horizonMinutes: 15,
    congestion: 'high',
    waitTimeP50Minutes: 15,
    waitTimeP90Minutes: 30,
    source: 'model',
  }

  it('서버가 보낸 시점 예측을 그대로 반환', () => {
    expect(findPrediction({ congestion: 'low', predictions: [p15] }, 15)).toBe(p15)
  })

  it('지금(0분)은 서버가 값을 보내도 현재 혼잡도만 씀, 대기시간은 null', () => {
    const p0: Prediction = { ...p15, horizonMinutes: 0, congestion: 'medium' }
    expect(findPrediction({ congestion: 'low', predictions: [p0, p15] }, 0)).toMatchObject({
      congestion: 'low',
      waitTimeP50Minutes: null,
    })
  })

  it('지금(0분) 값이 없어도 현재 혼잡도로 만듦', () => {
    expect(findPrediction({ congestion: 'low', predictions: [p15] }, 0)).toEqual({
      horizonMinutes: 0,
      congestion: 'low',
      waitTimeP50Minutes: null,
      waitTimeP90Minutes: null,
      source: null,
    })
  })

  it('현재 상태를 모르거나 운영 불가면 혼잡도 null', () => {
    expect(findPrediction({ congestion: 'unknown', predictions: [] }, 0)?.congestion).toBeNull()
    expect(findPrediction({ congestion: 'unavailable', predictions: [] }, 0)?.congestion).toBeNull()
  })

  it('15 · 30분 예측이 없으면 채우지 않음', () => {
    expect(findPrediction({ congestion: 'low', predictions: [] }, 30)).toBeUndefined()
  })
})
