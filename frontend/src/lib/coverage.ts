// 지도에 칠하는 서비스 범위와 같은 경계(useCoverageMask 참고)
import coverageBoundary from '@/assets/coverage-boundary.json'
import type { LatLng } from '@/types/geo'

const mapoRing = coverageBoundary.features[1].geometry.coordinates[0]

/**
 * 점이 다각형 고리 안에 있는지 판정. 점에서 오른쪽으로 선을 그어 경계와 몇 번 만나는지 셈 (홀수면 안)
 * 고리 좌표는 GeoJSON 순서 [경도, 위도]
 */
export function isPointInRing(point: LatLng, ring: number[][]) {
  let isInside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [lngA, latA] = ring[i]
    const [lngB, latB] = ring[j]
    // 변 A-B가 점의 위도를 가로지르고, 만나는 곳이 점보다 오른쪽이면 한 번 만난 것
    if (
      latA > point.lat !== latB > point.lat &&
      point.lng < ((lngB - lngA) * (point.lat - latA)) / (latB - latA) + lngA
    ) {
      isInside = !isInside
    }
  }
  return isInside
}

/** 예측 · 추천을 제공하는 마포구 안인지 */
export function isInMapo(point: LatLng) {
  return isPointInRing(point, mapoRing)
}
