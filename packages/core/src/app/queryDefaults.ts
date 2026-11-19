import type { DefaultOptions } from '@tanstack/react-query'
import { isRetryableError } from '../api/errors'
import { CACHE_TIME_MS, POLLING_INTERVAL_MS } from '../lib/constants'

/**
 * 웹 · 앱이 같이 쓰는 쿼리 기본값 (decisions.md 데이터 갱신). 각자 QueryClient를 만들 때 넣음
 * 화면이 안 보일 때 폴링을 멈추는 방식은 플랫폼마다 달라서 여기 넣지 않음
 * (웹: refetchIntervalInBackground, 앱: AppState · 화면 포커스)
 */
export const DEFAULT_QUERY_OPTIONS = {
  staleTime: POLLING_INTERVAL_MS,
  gcTime: CACHE_TIME_MS,
  refetchInterval: POLLING_INTERVAL_MS,
  // 일시적인 오류(네트워크 · 5xx)만 한 번 다시 시도
  retry: (failureCount, error) => failureCount < 1 && isRetryableError(error),
} satisfies DefaultOptions['queries']
