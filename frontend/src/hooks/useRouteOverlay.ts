import { useEffect } from 'react'
import type { LatLng } from '@/types/geo'

/** 브랜드 색(--color-brand-primary). 지도 SDK는 CSS 변수를 못 읽어 값으로 넣음 */
const ROUTE_COLOR = '#2563eb'

/**
 * 경로 선을 그리고 경로 전체가 보이게 지도를 맞춤. 아래쪽은 경로 시트에 가리지 않게 여백을 둠.
 * 경로가 없으면(경로 없음 · 로딩) 출발지와 도착지만 보이게 맞춤
 */
export function useRouteOverlay(
  map: naver.maps.Map | null,
  path: [number, number][] | undefined,
  fallbackPoints: LatLng[],
  bottomInset: number,
) {
  // 배열은 렌더마다 새로 만들어지므로 좌표 문자열로 바뀜을 판단
  const fallbackKey = fallbackPoints.map((p) => `${p.lat},${p.lng}`).join('|')

  useEffect(() => {
    if (!map) return
    const { maps } = window.naver
    const coords = path?.length
      ? path.map(([lat, lng]) => new maps.LatLng(lat, lng))
      : fallbackKey
          .split('|')
          .filter(Boolean)
          .map((key) => {
            const [lat, lng] = key.split(',').map(Number)
            return new maps.LatLng(lat, lng)
          })
    if (coords.length < 2) return

    const polyline = path?.length
      ? new maps.Polyline({
          map,
          path: coords,
          strokeColor: ROUTE_COLOR,
          strokeWeight: 5,
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
        })
      : null
    map.fitBounds(coords, { top: 100, right: 40, bottom: bottomInset + 40, left: 40 })

    return () => {
      // 인증 실패 시 SDK가 naver.maps를 비워 정리 호출도 예외를 던짐
      if (window.naver.maps) polyline?.setMap(null)
    }
  }, [map, path, fallbackKey, bottomInset])
}
