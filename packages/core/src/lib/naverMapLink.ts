import type { LatLng } from '../types/geo'

// 네이버 지도 앱 URL Scheme (NCP Maps "지도앱 연동 URL Scheme")
// URL만 만들고 여는 건 플랫폼마다 다름 (웹: frontend lib/openNaverMapApp.ts, 앱: Linking.openURL)

export type MobilePlatform = 'android' | 'ios' | 'other'

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

/** 웹 메르카토르(EPSG:3857) 지구 반둘레(m). 네이버 지도 웹 URL 좌표 단위 */
const MERCATOR_HALF_CIRCUMFERENCE = 20037508.34

/** 위경도를 네이버 지도 웹 URL이 쓰는 미터 좌표(EPSG:3857)로 바꿈 */
export function toWebMercator({ lat, lng }: LatLng) {
  const x = (lng * MERCATOR_HALF_CIRCUMFERENCE) / 180
  const y =
    (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / Math.PI) * MERCATOR_HALF_CIRCUMFERENCE
  return { x, y }
}

/**
 * PC용 네이버 지도 웹 자동차 길찾기 URL. 출발지는 비워 두어 사용자가 웹에서 직접 고름
 * 공식 문서가 없는 형식이라(지점 = x,y,이름,장소ID,PLACE_POI) 네이버가 바꾸면 깨질 수 있음
 */
export function getNaverWebCarRouteUrl(destination: LatLng & { name: string }) {
  const { x, y } = toWebMercator(destination)
  const goal = `${x.toFixed(2)},${y.toFixed(2)},${encodeURIComponent(destination.name)},,PLACE_POI`
  return `https://map.naver.com/p/directions/-/${goal}/-/car`
}

/**
 * 자동차 길찾기 URL. 출발지는 넣지 않아 앱이 사용자의 실제 현재 위치에서 안내함
 * (우리 화면의 출발지는 시연용 고정 좌표라 실제 운전 안내에 쓰면 안 됨)
 * Android는 intent URL이라 앱이 없으면 Play 스토어로 이동, PC는 앱이 없어 네이버 지도 웹 주소
 */
export function getNaverCarRouteUrl(
  { destination, appName }: NaverCarRouteOptions,
  platform: MobilePlatform,
) {
  // URLSearchParams는 띄어쓰기를 +로 바꾸는데, 네이버 지도 앱은 +를 글자 그대로 보여 줘 %20으로 바꿈
  // 이름에 원래 있던 +는 이미 %2B라서 띄어쓰기만 바뀜
  const query = new URLSearchParams({
    dlat: String(destination.lat),
    dlng: String(destination.lng),
    dname: destination.name,
    appname: appName,
  })
    .toString()
    .replaceAll('+', '%20')

  if (platform === 'android') {
    return `intent://route/car?${query}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end`
  }
  if (platform === 'ios') return `nmap://route/car?${query}`
  return getNaverWebCarRouteUrl(destination)
}
