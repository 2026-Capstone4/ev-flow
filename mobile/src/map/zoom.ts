/**
 * 앱 네이버 지도 SDK 줌 → 웹 JS API 줌
 * 같은 넓이가 보이려면 앱 줌이 웹보다 1 작음 (2026-11-20 시뮬레이터 측정: 앱 줌 14 = 가로 약 1.5km, 웹 줌 14 = 약 3km)
 * core mapMarkers의 줌 기준(점 · 숨김)은 웹 줌 숫자라, 앱에서는 바꿔서 넘김
 */
const WEB_ZOOM_OFFSET = 1

/** SDK가 정수 줌을 13.9999처럼 보낼 때 한 단계 아래로 내려가지 않게 더하는 여유 */
const ZOOM_EPSILON = 1e-6

/** 앱 줌을 웹 줌 숫자로 (소수 그대로, 화면 표시용) */
export function toWebZoom(appZoom: number) {
  return appZoom + WEB_ZOOM_OFFSET
}

/**
 * 앱 줌을 core 줌 기준에 넘길 웹 줌 단계로 (정수로 내림)
 * 웹 타일 지도는 줌이 정수로만 움직여서 13 → 14 사이 넓이(가로 6km → 3km)는 계속 13으로 보임
 * 앱은 13.5 같은 중간 줌이 있어 그대로 넘기면 13.01부터 숫자 마커로 바뀜 → 내려서 웹과 같은 구간에서 바뀌게 함
 */
export function toWebZoomLevel(appZoom: number) {
  return Math.floor(toWebZoom(appZoom) + ZOOM_EPSILON)
}

/** 웹 줌 숫자를 앱 SDK 줌으로 (첫 화면 줌 등 웹과 같은 값을 쓸 때) */
export function toAppZoom(webZoom: number) {
  return webZoom - WEB_ZOOM_OFFSET
}
