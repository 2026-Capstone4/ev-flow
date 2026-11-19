import '../../global.css'

import { setApiBaseUrl } from '@ev-flow/core/api/client'
import { MapViewProvider } from '@ev-flow/core/app/MapViewProvider'
import { enableRecommendationsMock } from '@ev-flow/core/mocks/axiosMock'
import { QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { queryClient, setupQueryManagers } from '../app-setup/queryClient'
import { ScreenActiveLayout } from '../app-setup/ScreenActiveLayout'
import { API_BASE_URL, IS_RECOMMENDATIONS_MOCK } from '../lib/config'

// 첫 요청 전에 API 주소를 앱용 절대 URL로 바꾸고, 앱 상태 · 네트워크를 쿼리에 연결함
// (core 기본값 /api/v1은 웹의 같은 출처 주소라 앱에서는 못 씀)
setApiBaseUrl(API_BASE_URL)
setupQueryManagers()
// 추천 API가 백엔드에 생기기 전까지 추천만 Mock으로 답함 (.env.local의 EXPO_PUBLIC_USE_MOCK=partial)
if (IS_RECOMMENDATIONS_MOCK) enableRecommendationsMock()

// 모든 화면을 감싸는 최상위 레이아웃. 쿼리 · 지도 시점 상태를 화면 사이에 공유함
export default function RootLayout() {
  return (
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
  )
}
