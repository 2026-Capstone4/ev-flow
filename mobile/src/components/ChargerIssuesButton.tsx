import { TriangleAlert } from 'lucide-react-native'
import { Pressable, Text } from 'react-native'
import { COLORS } from '@ev-flow/core/lib/theme'
import { FLOATING_BUTTON_SHADOW } from './BackButton'

type ChargerIssuesButtonProps = {
  onPress: () => void
}

/** 지도 홈 검색창 오른쪽 아래 작은 버튼. 누르면 상태 이상 충전기 목록 화면으로 감 */
export function ChargerIssuesButton({ onPress }: ChargerIssuesButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="상태 이상 충전기 보기"
      onPress={onPress}
      hitSlop={4}
      style={FLOATING_BUTTON_SHADOW}
      className="flex-row items-center gap-1 rounded-full bg-bg-page px-3 py-1.5 active:opacity-80"
    >
      <TriangleAlert size={14} strokeWidth={2.2} color={COLORS['status-warning']} />
      <Text className="font-medium text-xs text-text-primary">상태 이상</Text>
    </Pressable>
  )
}
