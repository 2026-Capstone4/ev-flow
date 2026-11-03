import type { LatLng } from '@/types/geo'

// 네이버 지도 앱 URL Scheme (NCP Maps "지도앱 연동 URL Scheme")

export type MobilePlatform = 'android' | 'ios' | 'other'

/** 네이버 지도 iOS 앱. 앱이 없을 때 App Store로 보냄 */
export const NAVER_MAP_APP_STORE_URL = 'http://itunes.apple.com/app/id311867728?mt=8'

export function detectPlatform(userAgent: string): MobilePlatform {
  if (/android/i.test(userAgent)) return 'android'
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios'
  return 'other'
}

type NaverCarRouteOptions = {
  destination: LatLng & { name: string }
  /** URL Scheme 필수 값. 웹 페이지는 페이지 URL */
  appName: string
}

/**
 * 자동차 길찾기 URL. 출발지는 넣지 않아 앱이 사용자의 실제 현재 위치에서 안내함
 * (우리 화면의 출발지는 시연용 고정 좌표라 실제 운전 안내에 쓰면 안 됨)
 * Android는 intent URL이라 앱이 없으면 Play 스토어로 이동, PC는 앱이 없어 null
 */
export function getNaverCarRouteUrl(
  { destination, appName }: NaverCarRouteOptions,
  platform: MobilePlatform,
) {
  const query = new URLSearchParams({
    dlat: String(destination.lat),
    dlng: String(destination.lng),
    dname: destination.name,
    appname: appName,
  }).toString()

  if (platform === 'android') {
    return `intent://route/car?${query}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end`
  }
  if (platform === 'ios') return `nmap://route/car?${query}`
  return null
}
