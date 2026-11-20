import { Text, View } from 'react-native'
import { DIRECTION_LABEL } from '@ev-flow/core/lib/serviceArea'
import type { Direction } from '@ev-flow/core/types/serviceArea'

/** 휴게소 방향 작은 꼬리표 (상행 · 하행) */
export function DirectionTag({ direction }: { direction: Direction }) {
  return (
    <View className="flex-shrink-0 rounded-sm bg-bg-subtle px-2 py-0.5">
      <Text className="font-medium text-xs text-text-secondary">{DIRECTION_LABEL[direction]}</Text>
    </View>
  )
}
