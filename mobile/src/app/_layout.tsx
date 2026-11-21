import '../../global.css'

import { setApiBaseUrl } from '@ev-flow/core/api/client'
import { MapViewProvider } from '@ev-flow/core/app/MapViewProvider'
import { QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { queryClient, setupQueryManagers } from '../app-setup/queryClient'
import { ScreenActiveLayout } from '../app-setup/ScreenActiveLayout'
import { API_BASE_URL } from '../lib/config'

// 첫 요청 전에 API 주소를 앱용 절대 URL로 바꾸고, 앱 상태 · 네트워크를 쿼리에 연결함
// (core 기본값 /api/v1은 웹의 같은 출처 주소라 앱에서는 못 씀)
setApiBaseUrl(API_BASE_URL)
setupQueryManagers()

// 모든 화면을 감싸는 최상위 레이아웃. 쿼리 · 지도 시점 상태를 화면 사이에 공유함
export default function RootLayout() {
  return (
    // 추천 시트(@gorhom/bottom-sheet)의 끌기 제스처가 동작하려면 앱 전체를 감싸야 함
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <MapViewProvider>
            {/* 화면마다 보이는지 여부를 쿼리 훅에 알려서 가려진 화면은 폴링을 멈춤 */}
            <Stack
              screenOptions={{ headerShown: false }}
              screenLayout={({ children }) => <ScreenActiveLayout>{children}</ScreenActiveLayout>}
            />
            <StatusBar style="dark" />
          </MapViewProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
