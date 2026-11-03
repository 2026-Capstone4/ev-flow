import { getDistanceMeters } from '@/lib/distance'
import type { LatLng } from '@/types/geo'
import type { RouteResponse, Station } from '@/types/station'

const METERS_PER_MINUTE = 350

// 실제 도로 대신 출발지 → 꺾이는 지점 → 도착지로 그린 화면 개발용 경로
// 경로 없음(05-1) 화면을 볼 수 있게 운영 불가 충전소는 경로를 찾지 못한 것으로 둠
export function buildMockRoute(origin: LatLng, station: Station): RouteResponse | null {
  if (station.congestion === 'unavailable') return null
  const corner: [number, number] = [origin.lat, station.lng]
  const path: [number, number][] = [[origin.lat, origin.lng], corner, [station.lat, station.lng]]
  const distanceMeters = Math.round(
    getDistanceMeters(origin, { lat: corner[0], lng: corner[1] }) +
      getDistanceMeters({ lat: corner[0], lng: corner[1] }, station),
  )
  return {
    stationId: station.stationId,
    travelTimeMinutes: Math.max(1, Math.round(distanceMeters / METERS_PER_MINUTE)),
    distanceMeters,
    path,
  }
}
