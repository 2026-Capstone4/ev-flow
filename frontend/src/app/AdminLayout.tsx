import { LogOut } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Suspense, useEffect } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { isUnauthorized } from '@ev-flow/core/api/errors'
import { ADMIN_PAGE_LOADERS } from '@/app/adminPages'
import { Button } from '@/components/Button'
import { useAuthMeQuery, useLogoutMutation } from '@/hooks/useAdminAuth'
import { prefetchAdminPage } from '@/hooks/useAdminQueries'
import { formatClock } from '@ev-flow/core/lib/formatUpdatedAt'
import type { AdminLoginState } from '@/pages/AdminLoginPage'

/** 사이드바 메뉴 — 메뉴마다 화면이 따로 있음 */
const NAV_ITEMS = [
  { label: '운영 현황', to: '/admin' },
  { label: '상태 이상 충전기', to: '/admin/charger-issues' },
  { label: '데이터 수집', to: '/admin/collection' },
]

/**
 * 운영자 화면 공통 틀 + 로그인 가드.
 * 로그인 상태(/auth/me)를 확인해서 로그인 안 됐거나 만료면 로그인 화면으로 보내고,
 * 로그인돼 있으면 사이드바와 함께 하위 화면(Outlet)을 보여 줌
 */
export function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const me = useAuthMeQuery()
  const logoutMutation = useLogoutMutation()
  const queryClient = useQueryClient()

  // 처음 들어온 화면의 코드 · 데이터를 로그인 확인(/auth/me)과 동시에 받기 시작 — 확인이 끝난 뒤 시작하면 그만큼 늦음
  // 로그인 안 된 상태면 401로 끝나고 로그인 화면으로 가므로 해가 없음. 로그인 직후 들어올 때도 이 자리에서 시작
  useEffect(() => {
    const pathname = location.pathname.replace(/\/$/, '')
    void ADMIN_PAGE_LOADERS[pathname]?.()
    prefetchAdminPage(queryClient, pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 레이아웃이 처음 열릴 때 한 번만 (메뉴 이동은 각 화면이 부름)
  }, [])

  // 401이면 로그인 화면으로. 이전 로그인 응답이 남아 있으면 쓰다가 만료된 것
  if (me.isError && isUnauthorized(me.error)) {
    const state: AdminLoginState = {
      from: location.pathname + location.search,
      expired: me.data !== undefined,
    }
    return <Navigate to="/admin/login" replace state={state} />
  }

  // 처음 로그인 상태를 확인하는 중
  if (me.isPending) {
    return (
      <div className="admin flex min-h-dvh items-center justify-center bg-bg-subtle text-sm text-text-secondary">
        로그인 상태 확인 중…
      </div>
    )
  }

  // 401이 아닌 오류(서버 · 네트워크)는 로그인 여부를 알 수 없어 다시 시도만 안내
  if (me.isError) {
    return (
      <div className="admin flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg-subtle">
        <p className="text-sm text-text-secondary">로그인 상태를 확인하지 못했습니다</p>
        <Button variant="secondary" onClick={() => me.refetch()}>
          다시 시도
        </Button>
      </div>
    )
  }

  const { admin, expiresAt } = me.data
  // 로그아웃 성공하면 로그인 화면으로 (만료 안내 없이)
  const handleLogout = () =>
    logoutMutation.mutate(undefined, {
      onSuccess: () => navigate('/admin/login', { replace: true }),
    })

  return (
    <div className="admin flex min-h-dvh flex-col bg-bg-subtle lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 bg-text-primary px-4 py-4 text-text-on-brand lg:sticky lg:top-0 lg:h-dvh lg:w-[232px] lg:gap-8 lg:py-8">
        <div className="flex items-center justify-between lg:block">
          <p className="text-lg font-bold">EV Flow 운영자</p>
          {/* 좁은 화면에서는 사이드바 아래쪽 계정 영역 대신 여기서 로그아웃 */}
          <button
            type="button"
            onClick={handleLogout}
            className="text-[13px] text-text-on-brand/70 lg:hidden"
          >
            로그아웃
          </button>
        </div>
        {/* 지금 보는 화면의 메뉴를 강조 (NavLink가 aria-current="page"도 붙여 줌) */}
        <nav className="flex gap-1 lg:flex-col">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              // /admin이 /admin/collection에서도 켜지지 않게 주소가 정확히 같을 때만 강조
              end
              className={({ isActive }) =>
                `rounded-sm px-3 py-2.5 text-sm ${
                  isActive ? 'bg-brand-primary font-bold' : 'font-medium text-text-on-brand/70'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden flex-col gap-2 border-t border-text-on-brand/15 pt-4 lg:flex">
          <p className="text-sm font-medium">{admin.name}</p>
          <p className="text-xs text-text-on-brand/60">
            {formatClock(new Date(expiresAt))}까지 로그인 유지
          </p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="inline-flex items-center gap-1.5 self-start text-[13px] text-text-on-brand/70 disabled:opacity-50"
          >
            <LogOut size={14} aria-hidden />
            로그아웃
          </button>
          {logoutMutation.isError && (
            <p role="alert" className="text-xs text-congestion-busy-bg">
              로그아웃하지 못했습니다. 다시 시도해 주세요.
            </p>
          )}
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
        {/* 화면 코드를 받는 동안 빈 화면 대신 안내 문구 (사이드바는 그대로 둠) */}
        <Suspense fallback={<p className="text-sm text-text-secondary">화면 불러오는 중…</p>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
