import { getCongestionLabel } from '@/lib/congestion'
import type { CurrentCongestion } from '@/types/station'

const MARKER_CLASS: Record<CurrentCongestion, string> = {
  low: 'bg-congestion-free',
  medium: 'bg-congestion-normal',
  high: 'bg-congestion-busy',
  unknown: 'bg-congestion-unknown',
  unavailable: 'bg-congestion-unavailable',
}

type StationMarkerProps = {
  availableChargers: number
  totalChargers: number
  congestion: CurrentCongestion
}

/** 숫자 = 사용 가능 대수/전체 대수, 색 = 현재 혼잡도 (예측 시점과 무관, REC-006) */
export function StationMarker({
  availableChargers,
  totalChargers,
  congestion,
}: StationMarkerProps) {
  return (
    <div
      aria-label={`사용 가능 ${availableChargers}/${totalChargers}대, ${getCongestionLabel(congestion)}`}
      className={`inline-flex cursor-pointer items-center whitespace-nowrap rounded-full border-2 border-white px-2 py-1 text-[13px] font-bold text-text-on-brand drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)] ${MARKER_CLASS[congestion]}`}
    >
      {availableChargers}/{totalChargers}
    </div>
  )
}
