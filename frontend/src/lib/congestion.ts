import type { CurrentCongestion } from '@/types/station'

export const CONGESTION_LABEL: Record<CurrentCongestion, string> = {
  low: '여유',
  medium: '보통',
  high: '혼잡',
  unknown: '확인 불가',
  unavailable: '운영 불가',
}

/** 예측 · 기준선이 모두 없을 때 표시 문구 (UC-U05 E2) */
export const NO_PREDICTION_LABEL = '조회 불가'

/** 현재 혼잡도는 null이 오지 않고, null은 예측이 없을 때만 */
export function getCongestionLabel(congestion: CurrentCongestion | null) {
  return congestion ? CONGESTION_LABEL[congestion] : NO_PREDICTION_LABEL
}

/** 대기 구간 (예: 5~15분, 대기 없음). 값이 없으면 null */
export function formatWaitRange(p50: number | null, p90: number | null) {
  if (p50 === null || p90 === null) return null
  if (p90 === 0) return '대기 없음'
  return `${p50}~${p90}분`
}

/** 카드 요약용 대기 구간 (예: 대기 5~15분) */
export function formatWaitTime(p50: number | null, p90: number | null) {
  const range = formatWaitRange(p50, p90)
  if (range === null || p90 === 0) return range
  return `대기 ${range}`
}
