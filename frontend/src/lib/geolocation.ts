/** 현재 위치를 쓰지 못한 이유 */
export type LocateFailure =
  'insecure' | 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'out-of-area'

export const LOCATE_FAILURE_MESSAGE: Record<LocateFailure, string> = {
  insecure: '현재 위치는 HTTPS 주소에서만 쓸 수 있어요',
  unsupported: '이 브라우저는 현재 위치를 지원하지 않아요',
  denied: '위치 권한이 꺼져 있어요. 브라우저 설정에서 허용해 주세요',
  unavailable: '현재 위치를 찾지 못했어요',
  timeout: '위치 확인이 늦어지고 있어요. 다시 시도해 주세요',
  'out-of-area': '마포구 외의 지역은 추천 기능을 지원하지 않아요',
}

/** 브라우저 위치 오류 코드(GeolocationPositionError.code)를 실패 이유로. 1 = 권한 거부, 3 = 시간 초과 */
export function toLocateFailure(code: number): LocateFailure {
  if (code === 1) return 'denied'
  if (code === 3) return 'timeout'
  // 2(위치 신호 없음)와 알 수 없는 코드는 모두 위치를 못 찾은 것으로 봄
  return 'unavailable'
}

/** catch로 잡은 값이 실패 이유인지. 코드 버그 같은 예상 못 한 오류를 걸러냄 */
export function isLocateFailure(value: unknown): value is LocateFailure {
  return typeof value === 'string' && Object.hasOwn(LOCATE_FAILURE_MESSAGE, value)
}
