import type { BottomTabBarProps } from 'expo-router/tabs'
import { Menu, type LucideIcon } from 'lucide-react-native'
import { Platform, Pressable, Text, View } from 'react-native'
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

/** iOS 홈 표시줄 칸을 이만큼 덜 비워서 탭 영역 전체(윗선 · 글자)를 그만큼 아래로 내림 */
const BOTTOM_INSET_TRIM = 8

/**
 * Android 아래 여백 최솟값. 제스처 내비게이션이면 앱이 받는 여백은 15dp쯤인데,
 * 삼성 기기는 맨 아래 41dp쯤을 시스템 내비게이션 창이 덮어 그 안을 누르면 앱에 닿지 않음
 * 탭 글자 가운데가 그 위로 오게 여백을 이만큼은 둠. 버튼 3개 내비게이션(48dp)은 원래 여백이 더 커서 그대로
 */
const ANDROID_MIN_BOTTOM_INSET = 24

/** 탭 줄 아래 여백. iOS는 홈 표시줄 칸을 조금 덜고, Android는 시스템 내비게이션 창에 가리지 않을 만큼 둠 */
function getBottomInset(insetBottom: number) {
  // Android는 덜지 않고 최솟값만 맞춤
  if (Platform.OS === 'android') return Math.max(insetBottom, ANDROID_MIN_BOTTOM_INSET)
  return Math.max(insetBottom - BOTTOM_INSET_TRIM, 0)
}

/** 웹 BottomTab과 같은 글자 하단 탭 + 오른쪽 끝 더보기 아이콘. 아래 여백은 getBottomInset 참고 */
export function BottomTab({ state, navigateToTab, insets }: BottomTabBarProps) {
  const bottomInset = getBottomInset(insets.bottom)
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
              <Text
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
