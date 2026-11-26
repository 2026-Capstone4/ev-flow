import { NaverMapPolygonOverlay, NaverMapPolylineOverlay } from '@mj-studio/react-native-naver-map'
// 출처: 통계청 SGIS 행정동 경계(공공누리 제1유형)를 vuski/admdongkor(CC BY 4.0, ver20261001)가 가공한 것
// 서울 · 마포구를 각각 하나로 합친 경계. 웹 useCoverageMask와 같은 파일. 모든 고리는 반시계 방향, 처음 = 끝 좌표
import coverageBoundary from '@ev-flow/core/assets/coverage-boundary.json'
import { COLORS } from '@ev-flow/core/lib/theme'

/** 서울 밖 — 서비스 안 함 (웹 #374151, 50%) */
const OUTSIDE_COLOR = 'rgba(55, 65, 81, 0.5)'
/** 서울 안 마포구 밖 — 실시간만, 예측 · 추천 없음 (웹 #6b7280, 15%) */
const SEOUL_COLOR = 'rgba(107, 114, 128, 0.15)'
/** 마포구 테두리. 브랜드 색 80% */
const MAPO_STROKE_COLOR = `${COLORS['brand-primary']}cc`

type Coord = { latitude: number; longitude: number }

/** 줌을 많이 줄여도 바깥 채움이 끊기지 않게 서울 주변을 덮는 사각형. SDK 규칙대로 시계 방향, 처음 = 끝 */
const OUTER_BOUNDS: Coord[] = [
  { latitude: 42, longitude: 120 },
  { latitude: 42, longitude: 134 },
  { latitude: 33, longitude: 134 },
  { latitude: 33, longitude: 120 },
  { latitude: 42, longitude: 120 },
]

/** GeoJSON 좌표 [경도, 위도]를 SDK 좌표로 바꿈 */
const toCoords = (ring: number[][]) => ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))

const [seoulFeature, mapoFeature] = coverageBoundary.features
// 파일 고리는 반시계라 구멍(holes)엔 그대로, 바깥 고리(coords)엔 뒤집어 시계 방향으로 넣음 (마포 테두리 선은 방향 상관없음)
const seoulHole = toCoords(seoulFeature.geometry.coordinates[0])
const mapoHole = toCoords(mapoFeature.geometry.coordinates[0])
const seoulOuter = [...seoulHole].reverse()

/**
 * 서비스 범위를 지도에 칠함. 서울 밖은 진한 회색, 서울 안 마포구 밖은 옅은 회색, 마포구는 채우지 않고 테두리만
 * 마커보다 아래(zIndex 음수)에 그려 마커 누르기를 가로채지 않음
 * Android SDK는 칠한 곳을 탭하면 지도 탭(onTapMap) 대신 이 오버레이가 받아서, 같은 동작을 onTap으로 넘겨받음
 */
export function CoverageMask({ onTap }: { onTap?: () => void }) {
  return (
    <>
      <NaverMapPolygonOverlay
        coords={OUTER_BOUNDS}
        holes={[seoulHole]}
        color={OUTSIDE_COLOR}
        zIndex={-3}
        onTap={onTap}
      />
      <NaverMapPolygonOverlay
        coords={seoulOuter}
        holes={[mapoHole]}
        color={SEOUL_COLOR}
        zIndex={-2}
        onTap={onTap}
      />
      {/* 마포구는 채우지 않고 테두리 선만. 투명 채움 폴리곤은 색 값이 0이 되어 SDK가 흰색으로 칠함 */}
      <NaverMapPolylineOverlay
        coords={mapoHole}
        color={MAPO_STROKE_COLOR}
        width={4}
        joinType="Round"
        zIndex={-1}
        onTap={onTap}
      />
    </>
  )
}
