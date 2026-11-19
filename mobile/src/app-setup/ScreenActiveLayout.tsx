import { ScreenActiveContext } from '@ev-flow/core/app/screenActive'
import { useIsFocused } from 'expo-router'
import type { ReactNode } from 'react'

/**
 * 화면 하나를 감싸 "지금 보이는지"를 core 쿼리 훅에 알림 (Stack의 screenLayout으로 모든 화면에 씌움)
 * 스택은 이전 화면을 살려 두므로, 가려진 화면은 false → 그 화면의 쿼리 구독을 끊어 폴링을 멈춤
 * 상위 내비게이터(나중에 탭 등)가 가려져도 useIsFocused가 false라 함께 멈춤
 */
export function ScreenActiveLayout({ children }: { children: ReactNode }) {
  const isFocused = useIsFocused()
  return <ScreenActiveContext.Provider value={isFocused}>{children}</ScreenActiveContext.Provider>
}
