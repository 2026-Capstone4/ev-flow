import { QueryClient } from '@tanstack/react-query'
import { CACHE_TIME_MS, POLLING_INTERVAL_MS } from '@/lib/constants'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: POLLING_INTERVAL_MS,
      gcTime: CACHE_TIME_MS,
      refetchInterval: POLLING_INTERVAL_MS,
      // 백그라운드 탭에서는 폴링 중단 (API 호출 수 절약)
      refetchIntervalInBackground: false,
      retry: 1,
    },
  },
})
