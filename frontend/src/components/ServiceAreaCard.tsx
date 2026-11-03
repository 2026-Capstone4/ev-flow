import { DirectionTag } from '@/components/DirectionTag'
import {
  AVAILABILITY_TONE_CLASS,
  formatStatusSummary,
  getAvailabilityTone,
} from '@/lib/serviceArea'
import type { ServiceArea } from '@/types/serviceArea'

type ServiceAreaCardProps = {
  serviceArea: ServiceArea
  onClick: () => void
}

/** 휴게소 현재 현황 카드. 예측이 없어 혼잡도 배지 · 대기 예측은 넣지 않음 (DATA-003) */
export function ServiceAreaCard({ serviceArea, onClick }: ServiceAreaCardProps) {
  const { name, direction, availableChargers, totalChargers, statusCounts } = serviceArea
  const tone = getAvailabilityTone(availableChargers, totalChargers, statusCounts.unknown)
  const summary = formatStatusSummary(statusCounts)

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-2.5 rounded-lg border border-border-default bg-bg-page p-4 text-left"
    >
      <div className="flex w-full items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-base font-bold">{name}</h2>
        <DirectionTag direction={direction} />
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className={`text-xl font-bold ${AVAILABILITY_TONE_CLASS[tone]}`}>
          사용 가능 {availableChargers}대
        </span>
        <span className="text-sm text-text-secondary">/ 급속 {totalChargers}기</span>
      </p>
      {summary && <p className="text-[13px] text-text-secondary">{summary}</p>}
    </button>
  )
}
