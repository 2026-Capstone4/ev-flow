import { useEffect } from 'react'
// 출처: 통계청 SGIS 행정동 경계(공공누리 제1유형)를 vuski/admdongkor(CC BY 4.0, ver20261001)가 가공한 것.
// 서울 427개 동 · 마포구 16개 동을 각각 하나로 합치고 점 수를 줄임. 모든 고리는 반시계 방향
import coverageBoundary from '@/assets/coverage-boundary.json'

/** 서울 밖 — 서비스 안 함 */
const OUTSIDE_COLOR = '#374151'
const OUTSIDE_OPACITY = 0.5
/** 서울 안 마포구 밖 — 실시간만, 예측 · 추천 없음 */
const SEOUL_COLOR = '#6b7280'
const SEOUL_OPACITY = 0.15
/** 마포구 테두리. 브랜드 색(--color-brand-primary), 지도 SDK는 CSS 변수를 못 읽어 값으로 넣음 */
const MAPO_STROKE_COLOR = '#2563eb'

/**
 * 최소 줌 8까지 줄여도 바깥 채움이 끊기지 않게 서울 주변을 덮는 사각형 (반시계).
 * 너무 크면 줌 20에서 픽셀 좌표가 브라우저 한계(약 1,670만 px)를 넘어 구멍이 사라지고 화면 전체가 회색이 됨.
 * 가로 14도는 줌 20에서 약 1,040만 px
 */
const OUTER_BOUNDS: [number, number][] = [
  [120, 33],
  [134, 33],
  [134, 42],
  [120, 42],
]

const [seoulFeature, mapoFeature] = coverageBoundary.features

/**
 * 서비스 범위를 지도에 칠함. 서울 밖은 진한 회색, 서울 안 마포구 밖은 옅은 회색, 마포구는 채우지 않고 테두리만.
 * 바깥 고리 안에 반대 방향 고리를 넣으면 그 부분이 구멍으로 뚫림
 */
export function useCoverageMask(map: naver.maps.Map | null) {
  useEffect(() => {
    // 지도가 아직 없으면(로딩 · 인증 실패) 그리지 않음
    if (!map) return
    const { maps } = window.naver
    // GeoJSON 좌표는 [경도, 위도] 순서라 LatLng(위도, 경도)로 뒤집어 넣음
    const toPath = (coords: number[][]) => coords.map(([lng, lat]) => new maps.LatLng(lat, lng))
    // 구멍은 바깥 고리와 반대 방향이어야 뚫리므로 순서를 뒤집음
    const toHole = (coords: number[][]) => toPath([...coords].reverse())

    const seoulRing = seoulFeature.geometry.coordinates[0]
    const mapoRing = mapoFeature.geometry.coordinates[0]
    // 채움만 쓰는 면은 지도 조작 · 마커 클릭을 가로채지 않게 함
    const common = { map, clickable: false, strokeOpacity: 0, zIndex: 0 }

    const overlays = [
      new maps.Polygon({
        ...common,
        paths: [toPath(OUTER_BOUNDS), toHole(seoulRing)],
        fillColor: OUTSIDE_COLOR,
        fillOpacity: OUTSIDE_OPACITY,
      }),
      new maps.Polygon({
        ...common,
        paths: [toPath(seoulRing), toHole(mapoRing)],
        fillColor: SEOUL_COLOR,
        fillOpacity: SEOUL_OPACITY,
      }),
      new maps.Polygon({
        ...common,
        paths: [toPath(mapoRing)],
        strokeColor: MAPO_STROKE_COLOR,
        strokeOpacity: 0.8,
        strokeWeight: 4,
        fillOpacity: 0,
      }),
    ]

    return () => {
      // 인증 실패 시 SDK가 naver.maps를 비워 정리 호출도 예외를 던짐
      if (window.naver.maps) overlays.forEach((overlay) => overlay.setMap(null))
    }
  }, [map])
}
