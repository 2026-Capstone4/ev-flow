import { CongestionBadge } from '@/components/CongestionBadge'
import { formatWaitTime } from '@/lib/congestion'
import type { Recommendation } from '@/types/station'

type RecommendCardProps = {
  recommendation: Recommendation
  onClick?: () => void
  tabIndex?: number
}

/** 대기는 범위(P50~P90)로 표시하고 신뢰도는 표시하지 않음 */
export function RecommendCard({ recommendation, onClick, tabIndex }: RecommendCardProps) {
  const { rank, station, congestion, travelTimeMinutes, travelTimeSource, reason } = recommendation
  const summary = [
    // 길찾기 실패로 직선거리 추정이면 근사값임을 표시
    `이동 ${travelTimeSource === 'estimate' ? '약 ' : ''}${travelTimeMinutes}분`,
    formatWaitTime(recommendation.waitTimeP50Minutes, recommendation.waitTimeP90Minutes),
    `사용 가능 ${station.availableChargers}/${station.totalChargers}대`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={tabIndex}
      className="flex w-full flex-col gap-2 rounded-lg border border-border-default bg-bg-page p-4 text-left"
    >
      <div className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-primary text-[13px] font-bold text-text-on-brand">
          {rank}
        </span>
        <h3 className="min-w-0 flex-1 truncate text-base font-bold">{station.name}</h3>
        <CongestionBadge congestion={congestion} />
      </div>
      <p className="text-sm text-text-secondary">{summary}</p>
      <p className="rounded-sm bg-brand-primary-bg px-3 py-2 text-[13px] font-medium text-brand-primary">
        {reason}
      </p>
    </button>
  )
}
