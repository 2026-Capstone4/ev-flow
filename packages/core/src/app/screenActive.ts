import { createContext, useContext } from 'react'

/**
 * 지금 이 화면이 사용자에게 보이는지. core 쿼리 훅이 TanStack Query `subscribed`로 넘김
 * false면 그 화면의 쿼리 구독(폴링 타이머 포함)을 끊고 캐시 값은 그대로 둠. 다시 true가 되면 낡은 데이터를 새로 받음
 *
 * 기본값 true → Provider를 안 두는 웹은 지금처럼 동작함 (웹은 탭 숨김을 refetchIntervalInBackground로 처리)
 * RN 앱은 스택이 이전 화면을 살려 두므로 화면마다 useIsFocused() 값을 Provider로 넣어 줌
 */
export const ScreenActiveContext = createContext(true)

/** core 쿼리 훅에서 씀. 가장 가까운 ScreenActiveContext 값 (없으면 true) */
export function useScreenActive() {
  return useContext(ScreenActiveContext)
}
