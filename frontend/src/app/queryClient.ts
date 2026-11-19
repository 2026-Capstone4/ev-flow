import { QueryCache, QueryClient } from '@tanstack/react-query'
import { isUnauthorized } from '@ev-flow/core/api/errors'
import { DEFAULT_QUERY_OPTIONS } from '@ev-flow/core/app/queryDefaults'
import { AUTH_ME_KEY } from '@/hooks/useAdminAuth'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // 대시보드 API가 401이면 로그인이 만료된 것 → 로그인 상태를 다시 확인해서 가드가 로그인 화면으로 보내게 함
    onError: (error, query) => {
      // 로그인 상태 쿼리 자체의 401은 제외 - 여기서 다시 부르면 401 → 다시 부름이 끝없이 반복됨
      if (isUnauthorized(error) && query.queryKey[0] !== AUTH_ME_KEY[0]) {
        queryClient.invalidateQueries({ queryKey: AUTH_ME_KEY })
      }
    },
  }),
  defaultOptions: {
    queries: {
      // 폴링 · 캐시 · 재시도는 웹 · 앱 공용 기본값
      ...DEFAULT_QUERY_OPTIONS,
      // 백그라운드 탭에서는 폴링 중단 (API 호출 수 절약). 브라우저 탭 기준이라 웹에만 둠
      refetchIntervalInBackground: false,
    },
  },
})
