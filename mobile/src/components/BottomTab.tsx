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

/** 웹 BottomTab과 같은 글자 하단 탭 + 오른쪽 끝 더보기 아이콘. 아래 여백은 홈 표시줄 높이만큼 둠 */
export function BottomTab({ state, navigateToTab, insets }: BottomTabBarProps) {
  return (
    // 왼쪽에도 아이콘 탭 폭(w-16)만큼 여백을 둬서, 글자 탭 두 개가 화면 가운데를 기준으로 좌우 대칭이 되게 함
    <View
      className="flex-row border-t border-border-default bg-bg-page pl-16"
      style={{ height: 48 + insets.bottom, paddingBottom: insets.bottom }}
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
              <Text
                style={{ transform: [{ translateX: TAB_LABEL_SHIFT_X[route.name] ?? 0 }] }}
                className={`text-[13px] ${
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
