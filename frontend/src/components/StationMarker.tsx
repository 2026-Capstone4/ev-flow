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
  /** 추천 Top 3 충전소인지. 맞으면 혼잡도 색 대신 형광 파랑으로 그림 */
  isRecommended?: boolean
}

/**
 * 숫자 = 사용 가능 대수/전체 대수, 색 = 현재 혼잡도 (예측 시점과 무관, REC-006)
 * 추천 충전소는 추천 시트에서 고른 시점 기준이라, 현재 혼잡도 색 대신 형광 파랑으로 구분
 */
export function StationMarker({
  availableChargers,
  totalChargers,
  congestion,
  isRecommended = false,
}: StationMarkerProps) {
  // 추천이면 형광 파랑 바탕 + 진한 글자, 아니면 혼잡도 색 바탕 + 흰 글자
  const colorClass = isRecommended
    ? 'bg-marker-recommended text-marker-recommended-text'
    : `${MARKER_CLASS[congestion]} text-text-on-brand`
  return (
    <div
      // 지도 탭 처리에서 숫자 마커를 누른 건지 가려낼 때 씀 (useStationMarkers)
      data-station-marker
      aria-label={`${isRecommended ? '추천 충전소, ' : ''}사용 가능 ${availableChargers}/${totalChargers}대, ${getCongestionLabel(congestion)}`}
      className={`inline-flex cursor-pointer items-center whitespace-nowrap rounded-full border-2 border-white px-2 py-1 text-[13px] font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)] ${colorClass}`}
    >
      {availableChargers}/{totalChargers}
    </div>
  )
}
