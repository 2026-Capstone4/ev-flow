import type { BottomTabBarProps } from 'expo-router/tabs'
import { Pressable, Text, View } from 'react-native'

/** 탭 화면 파일 이름별 글자. 순서는 (tabs)/_layout.tsx의 Tabs.Screen 순서를 따름 */
const TAB_LABEL: Record<string, string> = {
  index: '도심 충전소',
  'service-areas': '고속도로 휴게소',
}

/** 웹 BottomTab과 같은 글자만 있는 하단 탭. 아래 여백은 홈 표시줄 높이만큼 둠 */
export function BottomTab({ state, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View
      className="flex-row border-t border-border-default bg-bg-page"
      style={{ height: 48 + insets.bottom, paddingBottom: insets.bottom }}
    >
      {state.routes.map((route, index) => {
        const isActive = index === state.index
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => navigateToTab(route.key)}
            className="flex-1 items-center justify-center"
          >
            <Text
              className={`text-[13px] ${
                isActive ? 'font-bold text-brand-primary' : 'font-medium text-text-secondary'
              }`}
            >
              {TAB_LABEL[route.name] ?? route.name}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
