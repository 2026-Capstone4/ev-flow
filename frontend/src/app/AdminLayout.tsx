import { LogOut } from 'lucide-react'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { isUnauthorized } from '@/api/errors'
import { Button } from '@/components/Button'
import { useAuthMeQuery, useLogoutMutation } from '@/hooks/useAdminAuth'
import { COLLECTION_SECTION_ID, type SectionLinkState } from '@/hooks/useSectionHash'
import { formatClock } from '@/lib/formatUpdatedAt'
import type { AdminLoginState } from '@/pages/AdminLoginPage'

/** 사이드바 메뉴. hash가 빈 문자열이면 대시보드 맨 위(운영 현황) */
const NAV_ITEMS = [
  { label: '운영 현황', hash: '' },
  { label: '데이터 수집', hash: `#${COLLECTION_SECTION_ID}` },
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
      <div className="flex min-h-dvh items-center justify-center bg-bg-subtle text-sm text-text-secondary">
        로그인 상태 확인 중…
      </div>
    )
  }

  // 401이 아닌 오류(서버 · 네트워크)는 로그인 여부를 알 수 없어 다시 시도만 안내
  if (me.isError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg-subtle">
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
    <div className="flex min-h-dvh flex-col bg-bg-subtle lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 bg-text-primary px-4 py-4 text-text-on-brand lg:sticky lg:top-0 lg:h-dvh lg:w-[232px] lg:gap-8 lg:py-8">
        <div className="flex items-center justify-between lg:block">
          <p className="text-lg font-bold">EV-flow 관리자</p>
          {/* 좁은 화면에서는 사이드바 아래쪽 계정 영역 대신 여기서 로그아웃 */}
          <button
            type="button"
            onClick={handleLogout}
            className="text-[13px] text-text-on-brand/70 lg:hidden"
          >
            로그아웃
          </button>
        </div>
        {/* 두 메뉴 모두 같은 대시보드 화면 — 주소의 #해시로 지금 보는 영역을 구분해 강조 */}
        <nav className="flex gap-1 lg:flex-col">
          {NAV_ITEMS.map((item) => {
            const isActive = location.hash === item.hash
            return (
              <Link
                key={item.label}
                to={{ pathname: '/admin', hash: item.hash }}
                state={{ scroll: true } satisfies SectionLinkState}
                aria-current={isActive ? 'location' : undefined}
                className={`rounded-sm px-3 py-2.5 text-sm ${
                  isActive ? 'bg-brand-primary font-bold' : 'font-medium text-text-on-brand/70'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
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
        <Outlet />
      </main>
    </div>
  )
}
