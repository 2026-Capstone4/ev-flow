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
  /** 바깥에서 크기를 바꿀 때 (추천 카드는 길찾기 버튼과 같은 높이로 키움) */
  className?: string
  /** large = 추천 카드처럼 눌러야 하는 버튼 옆에 둘 때 글자 · 좌우 여백을 키움 */
  size?: 'default' | 'large'
}

const SIZE_CLASS = {
  default: { box: 'px-2', text: 'text-xs' },
  large: { box: 'px-3', text: 'text-[14px]' },
}

export function CongestionBadge({
  congestion,
  className = '',
  size = 'default',
}: CongestionBadgeProps) {
  const badgeClass = BADGE_CLASS[congestion ?? 'none']
  const sizeClass = SIZE_CLASS[size]
  return (
    <View
      className={`self-start justify-center rounded-sm py-1 ${sizeClass.box} ${badgeClass.box} ${className}`}
    >
      <Text className={`font-bold ${sizeClass.text} ${badgeClass.text}`}>
        {getCongestionLabel(congestion)}
      </Text>
    </View>
  )
}
