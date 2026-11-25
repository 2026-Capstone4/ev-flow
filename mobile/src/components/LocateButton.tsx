import { LocateFixed } from 'lucide-react-native'
import { ActivityIndicator, Pressable } from 'react-native'
import { COLORS } from '@ev-flow/core/lib/theme'
import { createShadow } from '../lib/shadow'

/** 웹 그림자(0 2px 8px 15%)를 RN 그림자 속성으로 옮김 */
const BUTTON_SHADOW = createShadow(2, 8, 0.15)

/** 버튼 지름 (웹 size-11). 지도 홈이 시트 위에 띄울 자리를 계산할 때 씀 */
export const LOCATE_BUTTON_SIZE = 44

type LocateButtonProps = {
  /** 위치를 재는 중이면 도는 표시를 보이고 다시 누를 수 없게 함 */
  isLocating: boolean
  onPress: () => void
}

/** 지도 우측 하단 현재 위치 버튼. 웹은 아이콘을 돌리지만 앱은 기본 로딩 표시를 씀 (NativeWind 애니메이션은 실험 기능) */
export function LocateButton({ isLocating, onPress }: LocateButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="현재 위치로 이동"
      accessibilityState={{ busy: isLocating, disabled: isLocating }}
      disabled={isLocating}
      onPress={onPress}
      hitSlop={4}
      style={[BUTTON_SHADOW, { width: LOCATE_BUTTON_SIZE, height: LOCATE_BUTTON_SIZE }]}
      className="items-center justify-center rounded-full bg-bg-page active:opacity-80"
    >
      {/* 재는 동안은 도는 표시, 아니면 위치 아이콘 */}
      {isLocating ? (
        <ActivityIndicator size="small" color={COLORS['text-secondary']} />
      ) : (
        <LocateFixed size={20} color={COLORS['text-primary']} />
      )}
    </Pressable>
  )
}
