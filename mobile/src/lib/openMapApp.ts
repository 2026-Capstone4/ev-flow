import { Linking } from 'react-native'
import { getKakaoCarRouteUrl } from '@ev-flow/core/lib/kakaoMapLink'
import { getNaverCarRouteUrl } from '@ev-flow/core/lib/naverMapLink'
import type { LatLng } from '@ev-flow/core/types/geo'

/** 네이버 지도 앱 URL Scheme의 appname. 앱은 번들 ID를 넣음 (app.config.ts ios.bundleIdentifier와 같은 값) */
const APP_NAME = 'app.evflowkr.evflow'

/** 지도 앱이 없을 때 여는 App Store 페이지. itms-apps는 App Store 앱을 바로 엶 */
const MAP_APP_STORE_URL = {
  naver: 'itms-apps://apps.apple.com/app/id311867728',
  kakao: 'itms-apps://apps.apple.com/app/id304608425',
} as const

export type MapApp = keyof typeof MAP_APP_STORE_URL

type Destination = LatLng & { name: string }

/** 고른 지도 앱의 자동차 길찾기 URL. 출발지는 넣지 않아 지도 앱이 실제 현재 위치에서 안내함 (계획 문서 10번) */
const getCarRouteUrl = (app: MapApp, destination: Destination) =>
  app === 'naver'
    ? getNaverCarRouteUrl({ destination, appName: APP_NAME }, 'ios')
    : getKakaoCarRouteUrl(destination, 'ios')

/**
 * 고른 지도 앱으로 목적지까지 자동차 길찾기를 엶. 앱이 없으면 App Store의 그 앱 페이지로
 * Info.plist LSApplicationQueriesSchemes에 nmap · kakaomap이 있어야 설치 여부를 알 수 있음 (app.config.ts)
 */
export async function openMapCarRoute(app: MapApp, destination: Destination) {
  const url = getCarRouteUrl(app, destination)
  try {
    // 앱이 깔려 있으면 바로 길찾기를 엶
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url)
      return
    }
  } catch {
    // Info.plist에 scheme이 빠진 빌드면 canOpenURL이 예외를 던짐 → 앱이 없는 것으로 보고 App Store로
  }
  try {
    await Linking.openURL(MAP_APP_STORE_URL[app])
  } catch {
    // App Store도 없는 곳(시뮬레이터)에서는 열 앱이 없어 아무것도 하지 않음
  }
}

/** 네이버 지도 앱으로 길찾기를 엶 (휴게소 상세) */
export const openNaverMapCarRoute = (destination: Destination) =>
  openMapCarRoute('naver', destination)
