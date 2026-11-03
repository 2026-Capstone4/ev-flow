import { describe, expect, it } from 'vitest'
import {
  formatDistance,
  matchesQuery,
  sortSearchResults,
  type StationSearchResult,
} from '@/lib/stationSearch'
import type { PredictedCongestion, Station } from '@/types/station'

const station = { name: '합정역 환승주차장 충전소', address: '서울 마포구 합정동' } as Station

describe('matchesQuery', () => {
  it('이름 · 주소에서 공백 무시하고 찾음', () => {
    expect(matchesQuery(station, '합정')).toBe(true)
    expect(matchesQuery(station, '환승 주차장')).toBe(true)
    expect(matchesQuery(station, '마포구')).toBe(true)
    expect(matchesQuery(station, '상암')).toBe(false)
  })

  it('검색어가 비면 모두 남김', () => {
    expect(matchesQuery(station, '  ')).toBe(true)
  })
})

function result(
  id: string,
  distanceMeters: number,
  congestion: PredictedCongestion | null,
  p50: number | null,
): StationSearchResult {
  return {
    station: { stationId: id } as Station,
    distanceMeters,
    prediction: {
      horizonMinutes: 30,
      congestion,
      waitTimeP50Minutes: p50,
      waitTimeP90Minutes: p50 === null ? null : p50 + 10,
      source: congestion ? 'model' : null,
    },
  }
}

describe('sortSearchResults', () => {
  const results = [
    result('far-low', 2000, 'low', 0),
    result('near-high', 300, 'high', 20),
    result('none', 100, null, null),
    result('mid-medium', 800, 'medium', 5),
  ]
  const ids = (key: Parameters<typeof sortSearchResults>[1]) =>
    sortSearchResults(results, key).map((r) => r.station.stationId)

  it('추천순은 예측 혼잡도 → 거리, 예측 없음은 맨 뒤', () => {
    expect(ids('recommended')).toEqual(['far-low', 'mid-medium', 'near-high', 'none'])
  })

  it('거리순', () => {
    expect(ids('distance')).toEqual(['none', 'near-high', 'mid-medium', 'far-low'])
  })

  it('대기 짧은순은 P50 기준, 예측 없음은 맨 뒤', () => {
    expect(ids('wait')).toEqual(['far-low', 'mid-medium', 'near-high', 'none'])
  })
})

describe('formatDistance', () => {
  it('1km 미만은 100m 단위, 이상은 km 소수 한 자리', () => {
    expect(formatDistance(830)).toBe('800m')
    expect(formatDistance(1420)).toBe('1.4km')
  })
})
