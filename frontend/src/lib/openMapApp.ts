import type { MobilePlatform } from '@ev-flow/core/lib/naverMapLink'

/** iOS 앱이 없을 때 보낼 App Store 주소 */
export const MAP_APP_STORE_URL = {
  naver: 'http://itunes.apple.com/app/id311867728?mt=8',
  kakao: 'http://itunes.apple.com/app/id304608425?mt=8',
} as const

export type MapApp = keyof typeof MAP_APP_STORE_URL

// iOS는 앱이 없으면 아무 일도 일어나지 않아, 잠시 뒤에도 화면이 그대로면 App Store로 보냄 (NCP 가이드 방식)
export function openMapApp(url: string, platform: MobilePlatform, app: MapApp) {
  // PC는 웹 지도라 지금 화면을 두고 새 탭에서 엶
  if (platform === 'other') {
    window.open(url, '_blank', 'noopener')
    return
  }
  window.location.href = url
  // Android intent URL은 앱이 없으면 알아서 Play 스토어로 가므로 여기서 끝냄
  if (platform !== 'ios') return
  setTimeout(() => {
    // 1.5초 뒤에도 화면이 보이면 앱이 안 열린 것 - 그 앱의 App Store로 보냄
    if (document.visibilityState === 'visible') window.location.href = MAP_APP_STORE_URL[app]
  }, 1500)
}
