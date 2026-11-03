import type { PredictedCongestion, Prediction, Station } from '@/types/station'

export type StationSortKey = 'recommended' | 'distance' | 'wait'

export type StationSearchResult = {
  station: Station
  distanceMeters: number
  /** 선택한 예측 시점의 예측 */
  prediction: Prediction | undefined
}

/** 공백 · 대소문자 차이를 무시하고 이름 · 주소로 찾음 (SRCH-001) */
export function matchesQuery(station: Station, query: string) {
  const normalize = (text: string) => text.replace(/\s/g, '').toLowerCase()
  const keyword = normalize(query)
  if (!keyword) return true
  return normalize(station.name).includes(keyword) || normalize(station.address).includes(keyword)
}

const CONGESTION_ORDER: Record<PredictedCongestion, number> = { low: 0, medium: 1, high: 2 }

/** 값이 없으면 맨 뒤로 */
function compareNullable(a: number | null | undefined, b: number | null | undefined) {
  return (a ?? Infinity) - (b ?? Infinity)
}

// 추천 점수는 화면에 보내지 않아(REC-002) 추천순은 예측 혼잡도 → 거리로 정렬
const COMPARE: Record<StationSortKey, (a: StationSearchResult, b: StationSearchResult) => number> =
  {
    recommended: (a, b) =>
      compareNullable(
        a.prediction?.congestion ? CONGESTION_ORDER[a.prediction.congestion] : null,
        b.prediction?.congestion ? CONGESTION_ORDER[b.prediction.congestion] : null,
      ) || a.distanceMeters - b.distanceMeters,
    distance: (a, b) => a.distanceMeters - b.distanceMeters,
    wait: (a, b) =>
      compareNullable(a.prediction?.waitTimeP50Minutes, b.prediction?.waitTimeP50Minutes) ||
      compareNullable(a.prediction?.waitTimeP90Minutes, b.prediction?.waitTimeP90Minutes) ||
      a.distanceMeters - b.distanceMeters,
  }

export function sortSearchResults(results: StationSearchResult[], key: StationSortKey) {
  return [...results].sort(COMPARE[key])
}

/** 거리 표기 (예: 800m, 1.4km) */
export function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters / 100) * 100}m` : `${(meters / 1000).toFixed(1)}km`
}
