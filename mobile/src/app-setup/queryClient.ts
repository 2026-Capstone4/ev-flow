import NetInfo from '@react-native-community/netinfo'
import { DEFAULT_QUERY_OPTIONS } from '@ev-flow/core/app/queryDefaults'
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query'
import { AppState, type AppStateStatus } from 'react-native'

/**
 * 앱 QueryClient. 폴링 · 캐시 · 재시도 기본값은 웹과 같은 core 값을 씀
 * 웹의 refetchIntervalInBackground는 브라우저 탭 기준이라 앱에서는 안 먹음 → 아래 focusManager로 대신함
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      ...DEFAULT_QUERY_OPTIONS,
      // 앱이 백그라운드(focusManager 기준 '포커스 없음')면 폴링을 멈춤
      refetchIntervalInBackground: false,
    },
  },
})

// 앱 상태가 바뀔 때 TanStack Query에 포커스 여부를 알림
// active면 다시 포커스 → 낡은 데이터는 바로 새로 받고 폴링 재개, 그 밖(background · inactive)이면 폴링 멈춤
function onAppStateChange(status: AppStateStatus) {
  focusManager.setFocused(status === 'active')
}

// 네트워크 연결 상태를 TanStack Query에 알림. 끊기면 요청을 미루고, 다시 연결되면 낡은 데이터를 새로 받음
function setupOnlineManager() {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      // 연결 여부를 아직 모르면(null) 연결된 것으로 봄. 막지 않고 요청해 보고 실패하면 오류로 처리
      setOnline(state.isConnected !== false)
    }),
  )
}

let isSetUp = false

/** 앱 시작 때 한 번 부름. AppState · NetInfo를 QueryClient에 연결함 */
export function setupQueryManagers() {
  // 빠른 새로고침(Fast Refresh)으로 다시 불려도 구독을 두 번 걸지 않음
  if (isSetUp) return
  isSetUp = true
  AppState.addEventListener('change', onAppStateChange)
  setupOnlineManager()
}
