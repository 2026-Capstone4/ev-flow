import { DEMO_USER_LOCATION, MAPO_CENTER } from '@ev-flow/core/lib/constants'
import { parseDemoLocation } from '@ev-flow/core/lib/demoLocation'
import type { LatLng } from '@ev-flow/core/types/geo'

/**
 * 앱 환경 변수. Expo는 EXPO_PUBLIC_로 시작하는 값만 앱 코드에 넣어 줌 (mobile/.env.local)
 * 값이 없으면 운영 서버를 씀. 로컬 백엔드(http)를 부르려면 개발 빌드에 ATS 예외가 필요함 (docs/app/migration-log.md 4번)
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://evflowkr.app/api/v1'

/**
 * 새 버전 안내 파일 주소. Nginx가 backend/nginx/app-meta 폴더를 바로 보여 줌 (웹 빌드와 상관없음)
 * 시험할 때만 .env.local에서 바꿈. 이미 설치된 앱이 계속 부르는 주소라 운영 값은 바꾸지 않음
 */
export const APP_VERSION_URL =
  process.env.EXPO_PUBLIC_APP_VERSION_URL || 'https://evflowkr.app/app-version.json'

/**
 * 현재 위치(GPS) 사용 여부 (웹 VITE_USE_GEOLOCATION과 같음). 꺼져 있어도 버튼은 보이고, 누르면 시연 위치로 지도만 옮김
 * 앱스토어 빌드는 켜고(.env.local의 EXPO_PUBLIC_USE_GEOLOCATION=true), 시연 영상 빌드는 비워서 시연 위치에 고정함
 */
export const IS_GEOLOCATION_ENABLED = process.env.EXPO_PUBLIC_USE_GEOLOCATION === 'true'

/**
 * 시연 위치 = 처음 추천 · 검색 · 길찾기 기준 위치 (.env.local의 EXPO_PUBLIC_DEMO_LOCATION="위도,경도")
 * 비우면 합정역 근처. 잘못 넣었거나 마포구 밖이면 경고를 남기고 합정역 근처로 둠
 */
function readDemoLocation(): LatLng {
  const text = process.env.EXPO_PUBLIC_DEMO_LOCATION
  const location = parseDemoLocation(text)
  // 값을 읽었으면 그 위치를 씀
  if (location) return location
  // 값을 넣었는데 못 읽었으면 녹화 전에 알아차리도록 경고만 남김 (빈 값은 기본값이라 조용히 넘어감)
  if (text?.trim()) {
    console.warn(
      `[config] EXPO_PUBLIC_DEMO_LOCATION="${text}"을 쓸 수 없어 합정역 근처로 둡니다. ` +
        '마포구 안의 "위도,경도"로 넣어 주세요',
    )
  }
  return DEMO_USER_LOCATION
}

export const DEMO_LOCATION = readDemoLocation()

/**
 * 첫 지도 가운데. 기본 화면(MAPO_CENTER · 합정역)과 같은 간격만큼 시연 위치에서 남쪽으로 내려서,
 * 시연 위치를 바꿔도 기준 위치 마커가 추천 시트에 가리지 않고 같은 자리에 보이게 함
 */
export const INITIAL_MAP_CENTER: LatLng = {
  lat: DEMO_LOCATION.lat + (MAPO_CENTER.lat - DEMO_USER_LOCATION.lat),
  lng: DEMO_LOCATION.lng + (MAPO_CENTER.lng - DEMO_USER_LOCATION.lng),
}
