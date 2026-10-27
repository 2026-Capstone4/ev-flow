import { getCongestionLabel } from '@/lib/congestion'
import type { Congestion } from '@/types/station'

const MARKER_CLASS: Record<Congestion | 'unknown', string> = {
  low: 'bg-congestion-free',
  medium: 'bg-congestion-normal',
  high: 'bg-congestion-busy',
  unknown: 'bg-congestion-unknown',
}

type StationMarkerProps = {
  availableChargers: number
  totalChargers: number
  congestion: Congestion | null
}

/** 숫자 = 사용 가능 대수/전체 대수, 색 = 선택한 예측 시점의 혼잡도 */
export function StationMarker({
  availableChargers,
  totalChargers,
  congestion,
}: StationMarkerProps) {
  return (
    <div
      aria-label={`사용 가능 ${availableChargers}/${totalChargers}대, ${getCongestionLabel(congestion)}`}
      className={`inline-flex cursor-pointer items-center whitespace-nowrap rounded-full border-2 border-white px-2 py-1 text-[13px] font-bold text-text-on-brand drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)] ${MARKER_CLASS[congestion ?? 'unknown']}`}
    >
      {availableChargers}/{totalChargers}
    </div>
  )
}
