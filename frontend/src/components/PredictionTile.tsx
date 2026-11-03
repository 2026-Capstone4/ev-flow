import { CongestionBadge } from '@/components/CongestionBadge'
import { formatWaitTime } from '@/lib/congestion'
import type { Prediction } from '@/types/station'

type PredictionTileProps = {
  prediction: Prediction
  isSelected: boolean
  onSelect: () => void
}

/** 상세 화면 "시간대별 혼잡 예측"의 한 칸 */
export function PredictionTile({ prediction, isSelected, onSelect }: PredictionTileProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      className={`flex min-w-0 flex-1 flex-col items-center gap-2 rounded-md px-2 py-3 ${
        isSelected
          ? 'border-[1.5px] border-brand-primary bg-brand-primary-bg'
          : 'border-[1.5px] border-transparent bg-bg-subtle'
      }`}
    >
      <span
        className={`text-[13px] ${isSelected ? 'font-bold text-brand-primary' : 'font-medium text-text-secondary'}`}
      >
        {prediction.horizonMinutes}분 후
      </span>
      <CongestionBadge congestion={prediction.congestion} />
      <span className="text-xs font-medium">
        {formatWaitTime(prediction.waitTimeP50Minutes, prediction.waitTimeP90Minutes) ?? '-'}
      </span>
    </button>
  )
}
