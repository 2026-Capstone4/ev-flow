import { Text, View } from 'react-native'
import { getCongestionLabel } from '@ev-flow/core/lib/congestion'
import type { CurrentCongestion } from '@ev-flow/core/types/station'

// RN은 글자색이 View에서 Text로 물려지지 않아 바탕 · 글자를 나눠 둠
const BADGE_CLASS: Record<CurrentCongestion | 'none', { box: string; text: string }> = {
  low: { box: 'bg-congestion-free-bg', text: 'text-congestion-free' },
  medium: { box: 'bg-congestion-normal-bg', text: 'text-congestion-normal' },
  high: { box: 'bg-congestion-busy-bg', text: 'text-congestion-busy' },
  unknown: { box: 'bg-congestion-unknown-bg', text: 'text-text-secondary' },
  unavailable: { box: 'bg-congestion-unavailable-bg', text: 'text-congestion-unavailable' },
  none: { box: 'bg-congestion-unknown-bg', text: 'text-text-secondary' },
}

type CongestionBadgeProps = {
  /** 현재 혼잡도 또는 예측 혼잡도. null은 예측 없음 */
  congestion: CurrentCongestion | null
}

export function CongestionBadge({ congestion }: CongestionBadgeProps) {
  const badgeClass = BADGE_CLASS[congestion ?? 'none']
  return (
    <View className={`self-start rounded-sm px-2 py-1 ${badgeClass.box}`}>
      <Text className={`font-bold text-xs ${badgeClass.text}`}>
        {getCongestionLabel(congestion)}
      </Text>
    </View>
  )
}
