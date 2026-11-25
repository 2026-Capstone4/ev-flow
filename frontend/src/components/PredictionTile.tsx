import { CongestionBadge } from '@/components/CongestionBadge'
import { formatWaitTime } from '@ev-flow/core/lib/congestion'
import { getHorizonLabel } from '@ev-flow/core/lib/horizon'
import type { Prediction } from '@ev-flow/core/types/station'

type PredictionTileProps = {
  prediction: Prediction
  isSelected: boolean
  onSelect: () => void
  /** 대기시간 자리에 대신 보여줄 글자 (지금 출발: 사용 가능 2/4대) */
  caption?: string
}

/** 상세 화면 "시간대별 혼잡 예측"의 한 칸 */
export function PredictionTile({ prediction, isSelected, onSelect, caption }: PredictionTileProps) {
  // 지금 출발은 사용 가능 대수, 그 외는 예상 대기시간. 둘 다 없으면 null
  const waitText =
    caption ??
    formatWaitTime(
      prediction.waitTimeP50Minutes,
      prediction.waitTimeP90Minutes,
      prediction.congestion,
    )
  // 15 · 30분 후처럼 앞으로의 시점이면 AI 예측 값
  const isForecast = prediction.horizonMinutes !== 0

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
        className={`text-[15px] ${isSelected ? 'font-bold text-brand-primary' : 'font-medium text-text-secondary'}`}
      >
        {getHorizonLabel(prediction.horizonMinutes)}
      </span>
      <CongestionBadge congestion={prediction.congestion} />
      {/* 대기시간(또는 사용 가능 대수)을 먼저, 그 아래 예측 시점이면 보라색 'AI 예측' 표시 */}
      {(waitText || isForecast) && (
        <span className="flex flex-col items-center gap-0.5">
          {/* 대기시간이 아직 없으면 이 줄은 빼고 'AI 예측'만 보여 줌 */}
          {waitText && <span className="text-xs font-semibold">{waitText}</span>}
          {isForecast && (
            <span className="text-[12px] font-semibold text-ai">
              <span aria-hidden="true">✦ </span>AI 예측
            </span>
          )}
        </span>
      )}
    </button>
  )
}
