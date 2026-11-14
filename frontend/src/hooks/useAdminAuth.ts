import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAuthMe, login, logout } from '@/api/admin'

export const AUTH_ME_KEY = ['auth', 'me'] as const

/** 운영자 쿼리 키 공통 앞부분 — 로그아웃 시 한꺼번에 지움 */
export const ADMIN_QUERY_KEY = ['admin'] as const

/**
 * 로그인 상태 (GET /auth/me). 로그인 안 됐거나 만료면 401 에러 상태가 됨.
 * 폴링하지 않음 — 대시보드 API가 401을 받으면 queryClient가 이 쿼리를 다시 부름
 */
export function useAuthMeQuery() {
  return useQuery({
    queryKey: AUTH_ME_KEY,
    queryFn: fetchAuthMe,
    staleTime: Infinity,
    refetchInterval: false,
  })
}

/** 로그인. 성공하면 응답을 로그인 상태 캐시에 바로 넣어 /auth/me를 다시 부르지 않음 */
export function useLoginMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: login,
    onSuccess: (session) => queryClient.setQueryData(AUTH_ME_KEY, session),
  })
}

/** 로그아웃. 성공하면 로그인 상태 · 대시보드 캐시를 지워 다음 운영자가 이전 데이터를 보지 않게 함 */
export function useLogoutMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ADMIN_QUERY_KEY })
      queryClient.removeQueries({ queryKey: AUTH_ME_KEY })
    },
  })
}
