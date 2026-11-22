import { Pressable, Text, View } from 'react-native'
import { formatWaitTime } from '@ev-flow/core/lib/congestion'
import { getHorizonLabel } from '@ev-flow/core/lib/horizon'
import type { Prediction } from '@ev-flow/core/types/station'
import { CongestionBadge } from './CongestionBadge'

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
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      onPress={onSelect}
      className={`min-w-0 flex-1 items-center gap-2 rounded-md border-[1.5px] px-2 py-3 ${
        isSelected ? 'border-brand-primary bg-brand-primary-bg' : 'border-transparent bg-bg-subtle'
      }`}
    >
      <Text
        className={`text-[13px] ${
          isSelected ? 'font-bold text-brand-primary' : 'font-medium text-text-secondary'
        }`}
      >
        {getHorizonLabel(prediction.horizonMinutes)}
      </Text>
      {/* 웹은 가운데 정렬 칸이라 배지도 가운데. 배지 기본값(self-start)을 덮지 않게 한 겹 감쌈 */}
      <View className="items-center">
        <CongestionBadge congestion={prediction.congestion} />
      </View>
      {/* 대기시간(또는 사용 가능 대수)을 먼저, 그 아래 예측 시점이면 보라색 'AI 예측' 표시 */}
      {(waitText || isForecast) && (
        <View className="items-center gap-0.5">
          {/* 대기시간이 아직 없으면 이 줄은 빼고 'AI 예측'만 보여 줌 */}
          {waitText && <Text className="font-semibold text-xs text-text-primary">{waitText}</Text>}
          {isForecast && <Text className="font-semibold text-[11px] text-ai">✦ AI 예측</Text>}
        </View>
      )}
    </Pressable>
  )
}
