import { NaverMapPolylineOverlay, type Region } from '@mj-studio/react-native-naver-map'
import { COLORS } from '@ev-flow/core/lib/theme'
import type { LatLng } from '@ev-flow/core/types/geo'

/** 경로 선 굵기 (웹 strokeWeight 5) */
const ROUTE_WIDTH = 5
/** 경로 끝 → 도착지 점선 굵기 (웹 strokeWeight 3) */
const LAST_MILE_WIDTH = 3
/** 점선 모양 [칠한 길이, 빈 길이] pt. 웹 shortdash와 비슷하게 짧게 끊음 */
const LAST_MILE_PATTERN = [6, 6]

type RouteOverlayProps = {
  /** 경로 좌표 [위도, 경도] 배열 (서버 응답 그대로) */
  path: [number, number][]
  /** 도착지(충전소) 위치. 경로 끝에서 여기까지 점선으로 이음 */
  destination: LatLng
}

/**
 * 경로 선과 경로 끝 → 도착지 회색 점선을 그림 (웹 useRouteOverlay와 같음)
 * 길찾기는 부지 안(주차장 등)까지 들어가지 않고 큰길에서 끝날 수 있어 남은 구간을 점선으로 보여 줌
 * 거의 붙어 있으면 점선이 안 보일 만큼 짧아 따로 거르지 않음
 */
export function RouteOverlay({ path, destination }: RouteOverlayProps) {
  // 선은 두 점 이상이어야 그릴 수 있음
  if (path.length < 2) return null
  const coords = path.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
  const end = coords[coords.length - 1]

  return (
    <>
      {/* 점선을 경로 선 아래에 깔아 경로 끝이 점선에 덮이지 않게 함 */}
      <NaverMapPolylineOverlay
        coords={[end, { latitude: destination.lat, longitude: destination.lng }]}
        width={LAST_MILE_WIDTH}
        color={COLORS['text-secondary']}
        pattern={LAST_MILE_PATTERN}
        capType="Round"
        zIndex={1}
      />
      <NaverMapPolylineOverlay
        coords={coords}
        width={ROUTE_WIDTH}
        color={COLORS['brand-primary']}
        capType="Round"
        joinType="Round"
        zIndex={2}
      />
    </>
  )
}

/**
 * 점들이 모두 들어가는 지도 범위. SDK Region은 남서쪽 모서리 + 위도 · 경도 폭
 * 점이 없으면 null
 */
export function toRegion(points: LatLng[]): Region | null {
  // 맞출 점이 없으면 범위도 없음
  if (points.length === 0) return null
  const lats = points.map((point) => point.lat)
  const lngs = points.map((point) => point.lng)
  const south = Math.min(...lats)
  const west = Math.min(...lngs)
  return {
    latitude: south,
    longitude: west,
    latitudeDelta: Math.max(...lats) - south,
    longitudeDelta: Math.max(...lngs) - west,
  }
}
