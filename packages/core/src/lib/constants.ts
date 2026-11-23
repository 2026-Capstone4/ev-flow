import type { LatLng } from '../types/geo'
import type { HorizonMinutes } from '../types/station'

/** 지도 초기 위치. 하단 추천 시트에 가리지 않도록 마포구 중심보다 남쪽으로 내림 */
export const MAPO_CENTER: LatLng = { lat: 37.5514, lng: 126.9212 }

/** 사용자 위치 기본값(시연용, 합정역 근처). 현재 위치 버튼으로 마포구 안 위치를 받으면 그 위치로 바뀜 (MAP-05) */
export const DEMO_USER_LOCATION: LatLng = { lat: 37.5535, lng: 126.9135 }

/** 데이터 폴링 주기 · 캐시 유지 시간 (decisions.md 데이터 갱신) */
export const POLLING_INTERVAL_MS = 60_000
export const CACHE_TIME_MS = 5 * 60_000

/**
 * 추천 호출 기준 (2026-11-22 결정, 서버 경로 캐시 없음 · 카카오 다중 목적지 1회 = 하루 1,000건 한도)
 * 5분마다, 또는 기준점에서 500m 넘게 움직이고 마지막 추천에서 2분 지났으면 지금 위치로 다시 부름
 * 5분 안에 같은 기준점 · 필터로 돌아오면 받아 둔 결과를 다시 보여 줌
 */
export const RECOMMEND_INTERVAL_MS = 5 * 60_000
export const RECOMMEND_MOVE_THRESHOLD_M = 500
export const RECOMMEND_MIN_INTERVAL_MS = 2 * 60_000

/** 처음 화면을 열 때 시점. 0 = 지금 출발 */
export const DEFAULT_HORIZON: HorizonMinutes = 0
