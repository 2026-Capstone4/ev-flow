import { isInMapo } from './coverage'
import type { LatLng } from '../types/geo'

/**
 * "위도,경도" 글자를 시연 위치로 바꿈 (앱 EXPO_PUBLIC_DEMO_LOCATION 값)
 * 숫자가 아니거나 마포구 밖이면 null. 마포구 밖은 지금 출발 추천만 오고 15 · 30분 추천이 없어서 시연 위치로 쓰지 않음
 */
export function parseDemoLocation(text: string | undefined): LatLng | null {
  // 값을 안 넣었으면 기본 시연 위치를 쓰도록 null
  if (!text?.trim()) return null
  const parts = text.split(',').map((part) => Number(part.trim()))
  // "37.5535,126.9135"처럼 숫자 두 개가 아니면 잘못 넣은 값
  if (parts.length !== 2 || parts.some((value) => !Number.isFinite(value))) return null
  const location = { lat: parts[0], lng: parts[1] }
  return isInMapo(location) ? location : null
}
