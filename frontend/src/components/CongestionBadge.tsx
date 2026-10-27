import { getCongestionLabel } from '@/lib/congestion'
import type { Congestion } from '@/types/station'

const BADGE_CLASS: Record<Congestion | 'unknown', string> = {
  low: 'bg-congestion-free-bg text-congestion-free',
  medium: 'bg-congestion-normal-bg text-congestion-normal',
  high: 'bg-congestion-busy-bg text-congestion-busy',
  unknown: 'bg-congestion-unknown-bg text-text-secondary',
}

type CongestionBadgeProps = {
  congestion: Congestion | null
}

export function CongestionBadge({ congestion }: CongestionBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-1 text-xs font-bold ${BADGE_CLASS[congestion ?? 'unknown']}`}
    >
      {getCongestionLabel(congestion)}
    </span>
  )
}
