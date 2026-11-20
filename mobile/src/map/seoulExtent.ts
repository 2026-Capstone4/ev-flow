import type { Region } from '@mj-studio/react-native-naver-map'
import coverageBoundary from '@ev-flow/core/assets/coverage-boundary.json'

// 서비스 범위 경계 파일의 첫 번째가 서울 (CoverageMask와 같은 파일). 고리는 [경도, 위도] 목록
const seoulRing = coverageBoundary.features[0].geometry.coordinates[0]
const latitudes = seoulRing.map(([, lat]) => lat)
const longitudes = seoulRing.map(([lng]) => lng)
const south = Math.min(...latitudes)
const west = Math.min(...longitudes)

/**
 * 서울 경계를 감싸는 사각형 (가로 약 37km · 세로 약 30km). 지도 가운데가 이 안에서만 움직이게 할 때 씀
 * SDK Region은 남서 모서리 + 위경도 차이
 */
export const SEOUL_EXTENT: Region = {
  latitude: south,
  longitude: west,
  latitudeDelta: Math.max(...latitudes) - south,
  longitudeDelta: Math.max(...longitudes) - west,
}
