import { Linking } from 'react-native'
import { getNaverCarRouteUrl } from '@ev-flow/core/lib/naverMapLink'
import type { LatLng } from '@ev-flow/core/types/geo'

/** 네이버 지도 앱 URL Scheme의 appname. 앱은 번들 ID를 넣음 (app.config.ts ios.bundleIdentifier와 같은 값) */
const APP_NAME = 'app.evflowkr.evflow'

/** 네이버 지도 iOS 앱의 App Store 페이지. itms-apps는 App Store 앱을 바로 엶 */
const NAVER_MAP_APP_STORE_URL = 'itms-apps://apps.apple.com/app/id311867728'

/**
 * 네이버 지도 앱으로 목적지까지 자동차 길찾기를 엶. 앱이 없으면 App Store의 네이버 지도 페이지로
 * 출발지는 넣지 않아 네이버 지도 앱이 실제 현재 위치에서 안내함 (계획 문서 10번)
 */
export async function openNaverMapCarRoute(destination: LatLng & { name: string }) {
  const url = getNaverCarRouteUrl({ destination, appName: APP_NAME }, 'ios')
  // Info.plist LSApplicationQueriesSchemes에 nmap이 있어야 설치 여부를 알 수 있음 (app.config.ts)
  if (await Linking.canOpenURL(url)) {
    await Linking.openURL(url)
    return
  }
  try {
    await Linking.openURL(NAVER_MAP_APP_STORE_URL)
  } catch {
    // App Store도 없는 곳(시뮬레이터)에서는 열 앱이 없어 아무것도 하지 않음
  }
}
