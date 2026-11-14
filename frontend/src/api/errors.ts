import { isAxiosError } from 'axios'
import type { ApiErrorBody } from '@/types/api'

/** 서버 에러 code. Nginx 502 · 504처럼 형식이 다르거나 네트워크 오류면 null */
export function getApiErrorCode(error: unknown) {
  if (!isAxiosError<ApiErrorBody>(error)) return null
  return error.response?.data?.error?.code ?? null
}

/** HTTP 상태 코드. 응답이 없으면(네트워크 오류 · 타임아웃) undefined */
export function getHttpStatus(error: unknown) {
  return isAxiosError(error) ? error.response?.status : undefined
}

/** 429 응답의 Retry-After(초). 헤더가 없거나 숫자가 아니면 null */
export function getRetryAfterSeconds(error: unknown) {
  if (!isAxiosError(error)) return null
  const seconds = Number(error.response?.headers['retry-after'])
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

/** 운영자 API의 로그인 없음 · 만료 (401 UNAUTHORIZED) */
export function isUnauthorized(error: unknown) {
  return getHttpStatus(error) === 401
}

/** 4xx는 다시 요청해도 결과가 같아 재시도하지 않음. 429는 Retry-After를 따라야 해서 제외 */
export function isRetryableError(error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  return status === undefined || status >= 500
}
