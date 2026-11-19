import type { LatLng } from '@/types/geo'
import type { HorizonMinutes } from '@/types/station'

/** 지도 초기 위치. 하단 추천 시트에 가리지 않도록 마포구 중심보다 남쪽으로 내림 */
export const MAPO_CENTER: LatLng = { lat: 37.5514, lng: 126.9212 }

/** 사용자 위치 기본값(시연용, 합정역 근처). 현재 위치 버튼으로 마포구 안 위치를 받으면 그 위치로 바뀜 (MAP-05) */
export const DEMO_USER_LOCATION: LatLng = { lat: 37.5535, lng: 126.9135 }

/** 데이터 폴링 주기 · 캐시 유지 시간 (decisions.md 데이터 갱신) */
export const POLLING_INTERVAL_MS = 60_000
export const CACHE_TIME_MS = 5 * 60_000

/** 처음 화면을 열 때 시점. 0 = 지금 출발 */
export const DEFAULT_HORIZON: HorizonMinutes = 0
