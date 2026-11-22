import { getCongestionLabel } from '@ev-flow/core/lib/congestion'
import type { CurrentCongestion } from '@ev-flow/core/types/station'

const BADGE_CLASS: Record<CurrentCongestion | 'none', string> = {
  low: 'bg-congestion-free-bg text-congestion-free',
  medium: 'bg-congestion-normal-bg text-congestion-normal',
  high: 'bg-congestion-busy-bg text-congestion-busy',
  unknown: 'bg-congestion-unknown-bg text-text-secondary',
  unavailable: 'bg-congestion-unavailable-bg text-congestion-unavailable',
  none: 'bg-congestion-unknown-bg text-text-secondary',
}

type CongestionBadgeProps = {
  /** 현재 혼잡도 또는 예측 혼잡도. null은 예측 없음 */
  congestion: CurrentCongestion | null
  /** 놓이는 곳에 맞춰 높이 등을 덧붙일 때 씀 */
  className?: string
  /** large = 추천 카드처럼 눌러야 하는 버튼 옆에 둘 때 글자 · 좌우 여백을 키움 */
  size?: 'default' | 'large'
}

const SIZE_CLASS = {
  default: 'px-2 text-xs',
  large: 'px-3 text-[13px]',
}

export function CongestionBadge({
  congestion,
  className = '',
  size = 'default',
}: CongestionBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-sm py-1 font-bold ${SIZE_CLASS[size]} ${BADGE_CLASS[congestion ?? 'none']} ${className}`}
    >
      {getCongestionLabel(congestion)}
    </span>
  )
}
