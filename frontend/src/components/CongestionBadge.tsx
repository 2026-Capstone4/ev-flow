import { getCongestionLabel } from '@/lib/congestion'
import type { CurrentCongestion } from '@/types/station'

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
}

export function CongestionBadge({ congestion }: CongestionBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-1 text-xs font-bold ${BADGE_CLASS[congestion ?? 'none']}`}
    >
      {getCongestionLabel(congestion)}
    </span>
  )
}
