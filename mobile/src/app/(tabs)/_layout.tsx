import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { ScreenActiveLayout } from '../../app-setup/ScreenActiveLayout'
import { BottomTab } from '../../components/BottomTab'

/**
 * 안 보이는 탭 화면을 네이티브 화면 트리에서 뗄지. Android만 떼지 않음
 * Android 네이버 지도는 떼면 멈췄다가 다시 붙을 때 그리기 면을 새로 만들어 도심 충전소 탭으로 돌아올 때 늦음
 * iOS는 떼었다 붙여도 금방 다시 그려서 기본값(뗌)을 그대로 둠
 */
const IS_DETACH_INACTIVE_TABS = Platform.OS !== 'android'

// 지도 홈 · 휴게소 목록 · 더보기를 오가는 하단 탭 (웹 BottomTab). 탭을 바꿔도 화면을 살려 둬서 지도를 다시 불러오지 않음
// 루트 Stack의 screenLayout은 탭 묶음 전체에만 씌워져서, 탭 화면마다 따로 씌워 가려진 탭의 폴링을 멈춤
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      detachInactiveScreens={IS_DETACH_INACTIVE_TABS}
      tabBar={(props) => <BottomTab {...props} />}
      screenLayout={({ children }) => <ScreenActiveLayout>{children}</ScreenActiveLayout>}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="service-areas" />
      <Tabs.Screen name="more" />
    </Tabs>
  )
}
