import type { LatLng } from '@/types/geo'
import type { Station } from '@/types/station'

/**
 * 지도 마커를 어떻게 그릴지 정하는 판단. 지도 SDK 없이 돌아서 웹 · 앱이 같이 씀
 * 줌 숫자는 웹 네이버 지도 JS API 기준. 앱 SDK는 같은 넓이가 보이는 줌이 다를 수 있어 옮길 때 다시 확인
 */

/**
 * 이 줌 이하에서는 숫자 대신 색 점으로 그림. 줌 13 ≈ 모바일 화면 가로 6km, 알약끼리 겹치기 시작함
 * 마포(예측 · 추천 대상)는 이 구간에서도 숫자를 유지
 */
export const DOT_MAX_ZOOM = 13
/** 이 줌 이하에서는 마커를 숨김. 줌 11이면 서울 대부분이 화면에 들어와 1,600여 개를 모두 그리게 됨 */
export const HIDDEN_MAX_ZOOM = 11
/** 색 점을 누르면 이 줌으로 확대해 숫자 마커를 보여 줌 (지도 첫 화면과 같은 줌) */
export const DOT_TAP_ZOOM = 14

/** 점 사이에 섞인 마포 숫자 마커가 점에 가리지 않게 위로 올림 */
const MAPO_Z_INDEX = 1
/** 추천 충전소 마커는 겹쳐도 다른 마커에 가리지 않게 가장 위로 */
const RECOMMENDED_Z_INDEX = 2

/** 화면 크기의 이 비율만큼 바깥까지 미리 그림. 지도를 조금 끌 때 마커가 늦게 뜨지 않게 함 */
const VIEW_MARGIN_RATIO = 0.3

/** 너무 멀리 봐서 마커를 모두 숨기는 줌인지 */
export function isHiddenZoom(zoom: number) {
  return zoom <= HIDDEN_MAX_ZOOM
}

/** 이 충전소를 숫자 마커 대신 색 점으로 그릴지. 마포(predictionAvailable) · 추천은 점 구간에서도 숫자로 그림 */
export function isDotStation(zoom: number, station: Station, isRecommended: boolean) {
  return zoom <= DOT_MAX_ZOOM && !station.predictionAvailable && !isRecommended
}

/** 마커 겹침 순서. 추천 > 마포 > 나머지 */
export function toZIndex(station: Station, isRecommended: boolean) {
  // 추천이면 가장 위
  if (isRecommended) return RECOMMENDED_Z_INDEX
  return station.predictionAvailable ? MAPO_Z_INDEX : 0
}

/** 마커 모양을 정하는 값만 이어 붙인 키. 키가 같으면 아이콘을 다시 만들지 않음 */
export function toMarkerKey(station: Station, isRecommended: boolean) {
  return `${station.availableChargers}/${station.totalChargers}/${station.congestion}/${isRecommended}`
}

export type ViewBounds = { south: number; west: number; north: number; east: number }

/** 화면의 남서 · 북동 모서리에 여유를 더한 위경도 범위 */
export function toViewBounds(southWest: LatLng, northEast: LatLng): ViewBounds {
  const latMargin = (northEast.lat - southWest.lat) * VIEW_MARGIN_RATIO
  const lngMargin = (northEast.lng - southWest.lng) * VIEW_MARGIN_RATIO
  return {
    south: southWest.lat - latMargin,
    west: southWest.lng - lngMargin,
    north: northEast.lat + latMargin,
    east: northEast.lng + lngMargin,
  }
}

/** 충전소가 범위 안에 있는지 (경계 포함) */
export function isInView(station: Station, view: ViewBounds) {
  return (
    station.lat >= view.south &&
    station.lat <= view.north &&
    station.lng >= view.west &&
    station.lng <= view.east
  )
}
