import { isAxiosError } from 'axios'
import type { ApiErrorBody } from '@/types/api'

/** 서버 에러 code. Nginx 502 · 504처럼 형식이 다르거나 네트워크 오류면 null */
export function getApiErrorCode(error: unknown) {
  if (!isAxiosError<ApiErrorBody>(error)) return null
  return error.response?.data?.error?.code ?? null
}

/** 4xx는 다시 요청해도 결과가 같아 재시도하지 않음. 429는 Retry-After를 따라야 해서 제외 */
export function isRetryableError(error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  return status === undefined || status >= 500
}
