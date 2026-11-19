/** 기다릴 시간을 화면 문구로. 1분 미만은 초, 1분 이상은 올림한 분 (예: 30초, 2분) */
export function formatWaitTime(seconds: number) {
  // 1분이 안 되면 초 그대로, 넘으면 분으로 올려서 실제보다 짧게 안내하지 않음
  return seconds < 60 ? `${seconds}초` : `${Math.ceil(seconds / 60)}분`
}

/**
 * 호출 제한(429 RATE_LIMITED) 안내의 "언제 다시" 부분. Retry-After(초)가 있으면 "30초 후", 없으면 "잠시 후".
 * 문장은 화면마다 줄바꿈이 달라서 앞뒤 문구는 화면에서 붙임
 */
export function getRetryWaitText(retryAfterSeconds: number | null) {
  // 서버가 남은 시간을 안 알려 줬으면 시간 없이 안내
  if (retryAfterSeconds === null) return '잠시 후'
  return `${formatWaitTime(retryAfterSeconds)} 후`
}
