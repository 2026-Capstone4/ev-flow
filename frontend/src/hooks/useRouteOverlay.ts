import { useEffect } from 'react'
import type { LatLng } from '@ev-flow/core/types/geo'

/** 브랜드 색(--color-brand-primary). 지도 SDK는 CSS 변수를 못 읽어 값으로 넣음 */
const ROUTE_COLOR = '#2563eb'
/** 경로 끝 → 도착지 점선 색(--color-text-secondary) */
const LAST_MILE_COLOR = '#6b7280'

/**
 * 경로 선을 그리고 경로 전체가 보이게 지도를 맞춤. 아래쪽은 경로 시트에 가리지 않게 여백을 둠.
 * 경로가 없으면(경로 없음 · 로딩) 출발지와 도착지만 보이게 맞춤.
 * 길찾기는 부지 안(주차장 등)까지 들어가지 않고 큰길에서 끝날 수 있어, 경로 끝에서 도착지(fallbackPoints 마지막)까지 회색 점선으로 이음
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
    const fallbackCoords = fallbackKey
      .split('|')
      .filter(Boolean)
      .map((key) => {
        const [lat, lng] = key.split(',').map(Number)
        return new maps.LatLng(lat, lng)
      })
    const coords = path?.length
      ? path.map(([lat, lng]) => new maps.LatLng(lat, lng))
      : fallbackCoords
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

    // 경로가 있고 도착지를 알 때만 끝점 → 도착지 점선을 그림. 거의 붙어 있으면 점선이 안 보일 만큼 짧아 따로 거르지 않음
    const destination = fallbackCoords.at(-1)
    const lastMile =
      path?.length && destination
        ? new maps.Polyline({
            map,
            path: [coords[coords.length - 1], destination],
            strokeColor: LAST_MILE_COLOR,
            strokeWeight: 3,
            strokeStyle: 'shortdash',
            strokeLineCap: 'round',
          })
        : null

    // 점선까지 보이게 도착지도 화면 맞춤에 넣음
    const boundsCoords = lastMile && destination ? [...coords, destination] : coords
    map.fitBounds(boundsCoords, { top: 100, right: 40, bottom: bottomInset + 40, left: 40 })

    return () => {
      // 인증 실패 시 SDK가 naver.maps를 비워 정리 호출도 예외를 던짐
      if (window.naver.maps) {
        polyline?.setMap(null)
        lastMile?.setMap(null)
      }
    }
  }, [map, path, fallbackKey, bottomInset])
}
