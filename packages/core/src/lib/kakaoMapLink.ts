import type { LatLng } from '../types/geo'
import type { MobilePlatform } from './naverMapLink'

// 카카오맵 앱 URL Scheme · 웹 길찾기 URL
// URL만 만들고 여는 건 플랫폼마다 다름 (웹: frontend lib/openMapApp.ts, 앱: Linking.openURL)
// 앱 Scheme(kakaomap://route)은 지금 공식 문서 페이지가 없어 데브톡 답변 기준. 실기기 확인 필요

/** 카카오맵 Android 앱 패키지. intent URL에서 앱이 없으면 Play 스토어로 보낼 때 씀 */
const KAKAO_MAP_ANDROID_PACKAGE = 'net.daum.android.map'

/**
 * PC용 카카오맵 웹 길찾기 URL (apis.map.kakao.com 웹 가이드 "길찾기 바로가기").
 * 도착지만 넣어 출발지는 사용자가 웹에서 직접 고름. 이름에 쉼표가 있으면 좌표와 섞여 띄어쓰기로 바꿈
 */
export function getKakaoWebRouteUrl(destination: LatLng & { name: string }) {
  const name = encodeURIComponent(destination.name.replaceAll(',', ' '))
  return `https://map.kakao.com/link/to/${name},${destination.lat},${destination.lng}`
}

/**
 * 자동차 길찾기 URL. 출발지(sp)는 넣지 않아 앱이 사용자의 실제 현재 위치에서 안내함
 * (우리 화면의 출발지는 시연용 고정 좌표라 실제 운전 안내에 쓰면 안 됨)
 * Android는 intent URL이라 앱이 없으면 Play 스토어로 이동, PC는 앱이 없어 카카오맵 웹 주소
 */
export function getKakaoCarRouteUrl(
  destination: LatLng & { name: string },
  platform: MobilePlatform,
) {
  // 도착지는 위도,경도 순서 · by=CAR는 자동차 길찾기
  const query = `ep=${destination.lat},${destination.lng}&by=CAR`

  if (platform === 'android') {
    return `intent://route?${query}#Intent;scheme=kakaomap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=${KAKAO_MAP_ANDROID_PACKAGE};end`
  }
  if (platform === 'ios') return `kakaomap://route?${query}`
  return getKakaoWebRouteUrl(destination)
}
