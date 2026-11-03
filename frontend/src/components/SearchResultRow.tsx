import { CongestionBadge } from '@/components/CongestionBadge'
import { formatWaitTime } from '@/lib/congestion'
import { formatDistance, type StationSearchResult } from '@/lib/stationSearch'

type SearchResultRowProps = {
  result: StationSearchResult
  onClick: () => void
}

/** 검색 결과 한 줄. 혼잡도는 선택한 예측 시점 기준 */
export function SearchResultRow({ result, onClick }: SearchResultRowProps) {
  const { station, distanceMeters, prediction } = result
  const summary = [
    formatDistance(distanceMeters),
    prediction && formatWaitTime(prediction.waitTimeP50Minutes, prediction.waitTimeP90Minutes),
    `사용 가능 ${station.availableChargers}/${station.totalChargers}대`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[60px] w-full items-center gap-3 border-b border-border-default px-4 py-3 text-left"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-bold">{station.name}</span>
        <span className="truncate text-[13px] text-text-secondary">{summary}</span>
      </div>
      <CongestionBadge congestion={prediction?.congestion ?? null} />
    </button>
  )
}
