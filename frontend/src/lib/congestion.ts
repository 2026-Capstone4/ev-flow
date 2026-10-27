import type { Congestion } from '@/types/station'

export const CONGESTION_LABEL: Record<Congestion, string> = {
  low: '여유',
  medium: '보통',
  high: '혼잡',
}

/** 예측값이 없을 때 표시 문구 */
export const NO_PREDICTION_LABEL = '예측 없음'

export function getCongestionLabel(congestion: Congestion | null) {
  return congestion ? CONGESTION_LABEL[congestion] : NO_PREDICTION_LABEL
}

/** 대기 구간 표기 (P50~P90). 값이 없으면 null */
export function formatWaitTime(p50: number | null, p90: number | null) {
  if (p50 === null || p90 === null) return null
  if (p90 === 0) return '대기 없음'
  return `대기 ${p50}~${p90}분`
}
