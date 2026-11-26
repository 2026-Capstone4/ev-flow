import { ArrowUp } from 'lucide-react-native'
import { Pressable } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { COLORS } from '@ev-flow/core/lib/theme'
import { createShadow } from '../lib/shadow'

/** 현재 위치 버튼과 같은 그림자 (웹 0 2px 8px 15%) */
const BUTTON_SHADOW = createShadow(2, 8, 0.15)

/** 버튼 지름. 현재 위치 버튼과 같은 크기 */
const BUTTON_SIZE = 44

type ScrollTopButtonProps = {
  /** 화면 아래 안전 영역. 이만큼 더 띄워 홈 표시줄과 겹치지 않게 함 */
  bottomInset: number
  onPress: () => void
}

/** 목록 우측 하단에 떠 있는 맨 위로 버튼. 나타나고 사라질 때 흐려지듯 바뀜 */
export function ScrollTopButton({ bottomInset, onPress }: ScrollTopButtonProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      className="absolute right-4"
      style={{ bottom: bottomInset + 16 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="목록 맨 위로"
        onPress={onPress}
        hitSlop={4}
        style={[BUTTON_SHADOW, { width: BUTTON_SIZE, height: BUTTON_SIZE }]}
        className="items-center justify-center rounded-full bg-bg-page active:opacity-80"
      >
        <ArrowUp size={20} color={COLORS['text-primary']} />
      </Pressable>
    </Animated.View>
  )
}
