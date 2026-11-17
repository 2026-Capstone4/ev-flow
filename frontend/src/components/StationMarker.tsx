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
  /** 지도를 멀리 볼 때 숫자 없이 혼잡도 색 점으로만 표시 */
  isCompact?: boolean
}

/** 숫자 = 사용 가능 대수/전체 대수, 색 = 현재 혼잡도 (예측 시점과 무관, REC-006) */
export function StationMarker({
  availableChargers,
  totalChargers,
  congestion,
  isCompact = false,
}: StationMarkerProps) {
  const label = `사용 가능 ${availableChargers}/${totalChargers}대, ${getCongestionLabel(congestion)}`
  // 멀리 볼 때는 알약끼리 겹쳐 숫자를 못 읽으므로 색 점만 그림
  if (isCompact) {
    return (
      <div
        aria-label={label}
        className={`size-3 cursor-pointer rounded-full border-2 border-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)] ${MARKER_CLASS[congestion]}`}
      />
    )
  }
  return (
    <div
      aria-label={label}
      className={`inline-flex cursor-pointer items-center whitespace-nowrap rounded-full border-2 border-white px-2 py-1 text-[13px] font-bold text-text-on-brand drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)] ${MARKER_CLASS[congestion]}`}
    >
      {availableChargers}/{totalChargers}
    </div>
  )
}
