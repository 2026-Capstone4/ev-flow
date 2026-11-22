import type { CurrentCongestion, PredictedCongestion } from '../types/station'

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

/** 혼잡 예측인데 P90이 0이면 대기 0분을 믿기 어려움 - 만차일 때 P90이 실제 대기를 덮는 비율이 낮음 */
export function isWaitUncertain(p90: number | null, congestion?: PredictedCongestion | null) {
  return p90 === 0 && congestion === 'high'
}

/** 대기 구간 (예: 5~15분, 대기 거의 없음). 값이 없으면 null */
export function formatWaitRange(
  p50: number | null,
  p90: number | null,
  congestion?: PredictedCongestion | null,
) {
  if (p50 === null || p90 === null) return null
  // 혼잡인데 P90이 0이면 0분이라고 말하지 않음
  if (isWaitUncertain(p90, congestion)) return '대기 예측 어려움'
  // P90이 0이어도 실제로 대기가 있던 경우가 있어 단정하지 않음
  if (p90 === 0) return '대기 거의 없음'
  return `${p50}~${p90}분`
}

/** 카드 요약용 대기 구간 (예: 대기 5~15분) */
export function formatWaitTime(
  p50: number | null,
  p90: number | null,
  congestion?: PredictedCongestion | null,
) {
  const range = formatWaitRange(p50, p90, congestion)
  // 범위가 아니면 문구에 이미 '대기'가 들어 있음
  if (range === null || p90 === 0) return range
  return `대기 ${range}`
}

/** 상세 화면 큰 글씨 아래 설명 줄. 설명이 필요 없으면 null */
export function getWaitNote(
  p50: number | null,
  p90: number | null,
  congestion?: PredictedCongestion | null,
) {
  // 대기 예측이 없으면 설명도 없음
  if (p50 === null || p90 === null) return null
  // 혼잡인데 대기 0분이면 빈 충전기가 없을 수 있다고 안내
  if (isWaitUncertain(p90, congestion)) {
    return '빈 충전기가 없을 수 있어요. 도착 전에 다시 확인하는 게 좋아요.'
  }
  // 대기가 거의 없으면 확률이라는 느낌만 줌
  if (p90 === 0) return '바로 충전할 가능성이 높아요'
  return null
}
