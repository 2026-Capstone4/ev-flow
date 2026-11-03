import type { LatLng } from '@/types/geo'

const EARTH_RADIUS_METERS = 6_371_000

/** 두 좌표 사이 직선거리(m). 실제 이동거리 · 시간은 서버 길찾기(POST /routes) 기준 */
export function getDistanceMeters(from: LatLng, to: LatLng) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(to.lat - from.lat)
  const dLng = toRad(to.lng - from.lng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a))
}
