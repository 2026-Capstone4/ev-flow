import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { getApiErrorCode, getRetryAfterSeconds } from '@/api/errors'
import { Button } from '@/components/Button'
import { useAuthMeQuery, useLoginMutation } from '@/hooks/useAdminAuth'
import { getLoginErrorMessage } from '@/lib/admin'

/** 가드(AdminLayout)가 로그인 화면으로 보낼 때 넘기는 값 */
export type AdminLoginState = {
  /** 로그인 후 돌아갈 주소 */
  from?: string
  /** 로그인돼 있다가 만료돼서 온 경우 true */
  expired?: boolean
}

export function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state ?? {}) as AdminLoginState
  const me = useAuthMeQuery()
  const loginMutation = useLoginMutation()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')

  // 이미 로그인된 상태로 들어오면 로그인 폼 대신 대시보드로 보냄
  if (me.isSuccess) return <Navigate to={state.from ?? '/admin'} replace />

  // 폼 제출: 로그인 성공하면 원래 가려던 화면(없으면 대시보드)으로 이동
  const submit = (event: FormEvent) => {
    event.preventDefault()
    loginMutation.mutate(
      { loginId: loginId.trim(), password },
      { onSuccess: () => navigate(state.from ?? '/admin', { replace: true }) },
    )
  }

  const errorMessage = loginMutation.isError
    ? getLoginErrorMessage(
        getApiErrorCode(loginMutation.error),
        getRetryAfterSeconds(loginMutation.error),
      )
    : null

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg-subtle px-4">
      <form
        onSubmit={submit}
        className="flex w-full max-w-[360px] flex-col gap-4 rounded-lg border border-border-default bg-bg-page p-6"
      >
        <header className="flex flex-col gap-1">
          <h1 className="text-[22px] font-bold">EV-flow 관리자</h1>
          <p className="text-[13px] text-text-secondary">운영자 계정으로 로그인해 주세요</p>
        </header>

        {state.expired && !errorMessage && (
          <p
            role="status"
            className="rounded-sm bg-status-warning-bg px-3 py-2 text-[13px] text-status-warning"
          >
            로그인이 만료됐습니다. 다시 로그인해 주세요.
          </p>
        )}

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          아이디
          <input
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            autoComplete="username"
            autoFocus
            className="rounded-sm border border-border-default px-3 py-2.5 text-[15px] font-normal outline-none focus:border-brand-primary"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="rounded-sm border border-border-default px-3 py-2.5 text-[15px] font-normal outline-none focus:border-brand-primary"
          />
        </label>

        {errorMessage && (
          <p role="alert" className="text-[13px] text-congestion-busy">
            {errorMessage}
          </p>
        )}

        <Button type="submit" disabled={!loginId.trim() || !password || loginMutation.isPending}>
          {loginMutation.isPending ? '로그인 중…' : '로그인'}
        </Button>
      </form>
    </div>
  )
}
