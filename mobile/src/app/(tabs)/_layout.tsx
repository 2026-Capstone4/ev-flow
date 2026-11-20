import { Tabs } from 'expo-router'
import { ScreenActiveLayout } from '../../app-setup/ScreenActiveLayout'
import { BottomTab } from '../../components/BottomTab'

// 지도 홈 · 휴게소 목록을 오가는 하단 탭 (웹 BottomTab). 탭을 바꿔도 두 화면을 살려 둬서 지도를 다시 불러오지 않음
// 루트 Stack의 screenLayout은 탭 묶음 전체에만 씌워져서, 탭 화면마다 따로 씌워 가려진 탭의 폴링을 멈춤
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTab {...props} />}
      screenLayout={({ children }) => <ScreenActiveLayout>{children}</ScreenActiveLayout>}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="service-areas" />
    </Tabs>
  )
}
