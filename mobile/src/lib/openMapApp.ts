import { Linking, Platform } from 'react-native'
import { getKakaoCarRouteUrl } from '@ev-flow/core/lib/kakaoMapLink'
import { getNaverCarRouteUrl } from '@ev-flow/core/lib/naverMapLink'
import type { LatLng } from '@ev-flow/core/types/geo'

/** 네이버 지도 앱 URL Scheme의 appname. 앱은 번들 ID · 패키지 이름을 넣음 (app.config.ts에서 iOS · Android 같은 값) */
const APP_NAME = 'app.evflowkr.evflow'

/** 지도 앱 Android 패키지 이름. Play 스토어 페이지를 열 때 씀 */
const MAP_APP_ANDROID_PACKAGE = {
  naver: 'com.nhn.android.nmap',
  kakao: 'net.daum.android.map',
} as const

/** 지도 앱이 없을 때 여는 App Store 페이지. itms-apps는 App Store 앱을 바로 엶 */
const MAP_APP_IOS_STORE_URL = {
  naver: 'itms-apps://apps.apple.com/app/id311867728',
  kakao: 'itms-apps://apps.apple.com/app/id304608425',
} as const

export type MapApp = keyof typeof MAP_APP_ANDROID_PACKAGE

type Destination = LatLng & { name: string }

/**
 * 고른 지도 앱의 자동차 길찾기 URL. 출발지는 넣지 않아 지도 앱이 실제 현재 위치에서 안내함 (docs/app/README.md 8번)
 * Android도 iOS와 같은 nmap:// · kakaomap:// 주소를 씀. core가 Android에 주는 intent:// 주소는 브라우저용이라 RN Linking이 못 엶
 */
const getCarRouteUrl = (app: MapApp, destination: Destination) =>
  app === 'naver'
    ? getNaverCarRouteUrl({ destination, appName: APP_NAME }, 'ios')
    : getKakaoCarRouteUrl(destination, 'ios')

/** 지도 앱이 없을 때 그 앱의 스토어 페이지를 엶. Android는 Play 스토어 앱, 없으면 Play 웹 페이지 */
async function openStorePage(app: MapApp) {
  // iOS는 App Store 앱으로
  if (Platform.OS !== 'android') {
    await Linking.openURL(MAP_APP_IOS_STORE_URL[app])
    return
  }
  const packageName = MAP_APP_ANDROID_PACKAGE[app]
  try {
    await Linking.openURL(`market://details?id=${packageName}`)
  } catch {
    // Play 스토어 앱이 없는 기기(일부 에뮬레이터 등)는 브라우저로 Play 웹 페이지를 엶
    await Linking.openURL(`https://play.google.com/store/apps/details?id=${packageName}`)
  }
}

/**
 * 고른 지도 앱으로 목적지까지 자동차 길찾기를 엶. 앱이 없으면 스토어의 그 앱 페이지로
 * 설치 여부를 알려면 iOS는 Info.plist LSApplicationQueriesSchemes, Android는 manifest queries에 nmap · kakaomap이 있어야 함 (app.config.ts)
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
    // 설치 확인 목록에 scheme이 빠진 빌드면 iOS canOpenURL이 예외를 던짐 → 앱이 없는 것으로 보고 스토어로
  }
  try {
    await openStorePage(app)
  } catch {
    // 스토어도 브라우저도 없는 곳(시뮬레이터)에서는 열 곳이 없어 아무것도 하지 않음
  }
}

/** 네이버 지도 앱으로 길찾기를 엶 (휴게소 상세) */
export const openNaverMapCarRoute = (destination: Destination) =>
  openMapCarRoute('naver', destination)
