import { Pressable } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import Svg, { Path, Text as SvgText } from 'react-native-svg'
import { COLORS } from '@ev-flow/core/lib/theme'
import { createShadow } from '../lib/shadow'
import { LOCATE_BUTTON_SIZE } from './LocateButton'

/** 현재 위치 버튼과 같은 그림자 · 크기 */
const BUTTON_SHADOW = createShadow(2, 8, 0.15)

/** 바늘을 그리는 칸 크기. 버튼 지름보다 작게 둠 */
const ICON_SIZE = 26

type CompassButtonProps = {
  /** 지도가 돌아간 각도(도, 시계 방향). 바늘은 그 반대로 돌려 늘 북쪽을 가리킴 */
  bearing: SharedValue<number>
  onPress: () => void
}

/** 지도를 돌리거나 기울였을 때 보이는 나침반 버튼. 누르면 북쪽이 위로 오게 되돌림 */
export function CompassButton({ bearing, onPress }: CompassButtonProps) {
  // 지도 회전 이벤트마다 화면을 다시 그리지 않도록 UI 스레드에서 바늘만 돌림
  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-bearing.value}deg` }],
  }))

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="지도 북쪽을 위로 맞추기"
      onPress={onPress}
      hitSlop={4}
      style={[BUTTON_SHADOW, { width: LOCATE_BUTTON_SIZE, height: LOCATE_BUTTON_SIZE }]}
      className="items-center justify-center rounded-full bg-bg-page active:opacity-80"
    >
      <Animated.View style={needleStyle}>
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 26 26">
          {/* 북쪽 바늘(빨강) · 남쪽 바늘(회색) */}
          <Path d="M13 6 L17 13 L9 13 Z" fill={COLORS['congestion-busy']} />
          <Path d="M13 20 L17 13 L9 13 Z" fill={COLORS['congestion-unknown']} />
          <SvgText
            x={13}
            y={5}
            fontSize={6}
            fontWeight="700"
            textAnchor="middle"
            fill={COLORS['text-primary']}
          >
            N
          </SvgText>
        </Svg>
      </Animated.View>
    </Pressable>
  )
}
