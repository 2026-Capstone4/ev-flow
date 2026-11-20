import { Pressable, Text, View } from 'react-native'
import {
  AVAILABILITY_TONE_CLASS,
  formatStatusSummary,
  getAvailabilityTone,
} from '@ev-flow/core/lib/serviceArea'
import type { ServiceArea } from '@ev-flow/core/types/serviceArea'
import { DirectionTag } from './DirectionTag'

type ServiceAreaCardProps = {
  serviceArea: ServiceArea
  onPress: () => void
}

/** 휴게소 현재 현황 카드. 예측이 없어 혼잡도 배지 · 대기 예측은 넣지 않음 (DATA-003) */
export function ServiceAreaCard({ serviceArea, onPress }: ServiceAreaCardProps) {
  const { name, direction, availableChargers, totalChargers, statusCounts } = serviceArea
  const tone = getAvailabilityTone(availableChargers, totalChargers, statusCounts.unknown)
  const summary = formatStatusSummary(statusCounts)

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="w-full gap-2.5 rounded-lg border border-border-default bg-bg-page p-4 active:opacity-80"
    >
      <View className="w-full flex-row items-center gap-2">
        <Text numberOfLines={1} className="min-w-0 flex-1 font-bold text-base text-text-primary">
          {name}
        </Text>
        <DirectionTag direction={direction} />
      </View>
      {/* 큰 글자와 작은 글자의 글자 바닥선을 맞추려고 한 Text 안에 넣음 (RN View에는 baseline 정렬이 약함) */}
      <Text>
        <Text className={`font-bold text-xl ${AVAILABILITY_TONE_CLASS[tone]}`}>
          사용 가능 {availableChargers}대
        </Text>
        <Text className="font-sans text-sm text-text-secondary"> / 급속 {totalChargers}기</Text>
      </Text>
      {summary && <Text className="font-sans text-[13px] text-text-secondary">{summary}</Text>}
    </Pressable>
  )
}
