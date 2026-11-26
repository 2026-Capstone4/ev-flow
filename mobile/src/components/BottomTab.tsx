import type { BottomTabBarProps } from 'expo-router/tabs'
import { Menu, type LucideIcon } from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'
import { COLORS } from '@ev-flow/core/lib/theme'

/** 탭 화면 파일 이름별 글자. 순서는 (tabs)/_layout.tsx의 Tabs.Screen 순서를 따름 */
const TAB_LABEL: Record<string, string> = {
  index: '도심 충전소',
  'service-areas': '고속도로 휴게소',
  more: '더보기',
}

/** 글자 위치만 옮기는 값(px). 누르는 영역은 그대로 둠. 웹 BottomTab shiftClass와 같은 값 */
const TAB_LABEL_SHIFT_X: Partial<Record<string, number>> = {
  // 도심 충전소 글자를 왼쪽으로 15px 옮김
  index: -15,
}

/** 글자 대신 아이콘만 보여 주는 탭. 글자는 화면 읽기 프로그램용 이름으로만 씀 */
const TAB_ICON: Partial<Record<string, LucideIcon>> = {
  more: Menu,
}

/** 폰 글꼴 크기 설정을 따르되 이 배수까지만 키움. 더 커지면 좁은 폰에서 탭 글자가 두 줄로 넘어가 잘림 */
const TAB_LABEL_MAX_FONT_SCALE = 1.2

/** 홈 표시줄 칸을 이만큼 덜 비워서 탭 영역 전체(윗선 · 글자)를 그만큼 아래로 내림 */
const BOTTOM_INSET_TRIM = 8

/** 웹 BottomTab과 같은 글자 하단 탭 + 오른쪽 끝 더보기 아이콘. 아래 여백은 홈 표시줄 높이에서 조금 덜어 둠 */
export function BottomTab({ state, navigateToTab, insets }: BottomTabBarProps) {
  const bottomInset = Math.max(insets.bottom - BOTTOM_INSET_TRIM, 0)
  return (
    // 왼쪽에도 아이콘 탭 폭(w-16)만큼 여백을 둬서, 글자 탭 두 개가 화면 가운데를 기준으로 좌우 대칭이 되게 함
    // 글자 칸 높이(52)는 그대로 두고 아래 여백만 줄임. 홈 표시줄이 없는 기기(아래 여백 0)는 줄일 여백이 없어 그대로
    <View
      className="flex-row border-t border-border-default bg-bg-page pl-16"
      style={{
        height: 52 + bottomInset,
        paddingBottom: bottomInset,
      }}
    >
      {state.routes.map((route, index) => {
        const isActive = index === state.index
        const label = TAB_LABEL[route.name] ?? route.name
        const Icon = TAB_ICON[route.name]
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: isActive }}
            onPress={() => navigateToTab(route.key)}
            // 아이콘 탭은 좁게 두고, 남는 폭은 글자 탭이 나눠 씀
            className={`items-center justify-center ${Icon ? 'w-16' : 'flex-1'}`}
          >
            {/* 아이콘 탭이면 아이콘만, 아니면 글자 */}
            {Icon ? (
              <Icon
                size={20}
                strokeWidth={isActive ? 2.5 : 2}
                color={isActive ? COLORS['brand-primary'] : COLORS['text-secondary']}
              />
            ) : (
              // 한 줄로 고정하고, 칸보다 길면 잘리지 않게 글자를 칸에 맞춰 줄임
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                maxFontSizeMultiplier={TAB_LABEL_MAX_FONT_SCALE}
                style={{ transform: [{ translateX: TAB_LABEL_SHIFT_X[route.name] ?? 0 }] }}
                className={`text-[15px] ${
                  isActive ? 'font-bold text-brand-primary' : 'font-medium text-text-secondary'
                }`}
              >
                {label}
              </Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}
