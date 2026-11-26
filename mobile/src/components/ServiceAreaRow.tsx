import { ChevronRight } from 'lucide-react-native'
import { Pressable } from 'react-native'
import { Text } from './Text'
import { AVAILABILITY_TONE_CLASS, getAvailabilityTone } from '@ev-flow/core/lib/serviceArea'
import { COLORS } from '@ev-flow/core/lib/theme'
import type { NationwideServiceArea } from '@ev-flow/core/types/serviceArea'

type ServiceAreaRowProps = {
  serviceArea: NationwideServiceArea
  /** 보여 줄 이름. 노선 화면(방향 탭 안)은 shortName, 그 밖은 name */
  title: string
  /** 이름 옆에 작게 붙이는 글자 (표지판 방향 '대전 방향', '양방향') */
  note?: string | null
  onPress: () => void
  /** 묶음의 첫 줄이면 위 구분선을 그리지 않음 */
  isFirst?: boolean
}

/** 전국 휴게소 목록 한 줄. 이름 · 사용 가능 충전기 수 · 화살표 */
export function ServiceAreaRow({
  serviceArea,
  title,
  note,
  onPress,
  isFirst = false,
}: ServiceAreaRowProps) {
  const { availableChargers, totalChargers, statusCounts } = serviceArea
  const tone = getAvailabilityTone(availableChargers, totalChargers, statusCounts.unknown)

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`min-h-[56px] flex-row items-center gap-2 px-4 py-3 active:bg-bg-subtle ${
        isFirst ? '' : 'border-t border-border-default'
      }`}
    >
      <Text numberOfLines={1} className="min-w-0 flex-1 text-[16px]">
        <Text className="font-medium text-text-primary">{title}</Text>
        {note && <Text className="font-sans text-xs text-text-secondary"> {note}</Text>}
      </Text>
      <Text className="font-sans text-sm text-text-secondary">
        사용 가능{' '}
        <Text className={`font-bold ${AVAILABILITY_TONE_CLASS[tone]}`}>{availableChargers}</Text>/
        {totalChargers}
      </Text>
      <ChevronRight size={18} strokeWidth={2} color={COLORS['text-secondary']} />
    </Pressable>
  )
}
