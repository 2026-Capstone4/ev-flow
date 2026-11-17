import { NavLink } from 'react-router'

const TABS = [
  { to: '/', label: '도심 충전소' },
  { to: '/service-areas', label: '고속도로 휴게소' },
]

export function BottomTab() {
  return (
    // 아래 여백은 홈 인디케이터가 있는 기기에서만 그 높이만큼 둠. 브라우저 툴바가 보일 때는 0
    <nav className="flex h-[calc(48px+env(safe-area-inset-bottom))] shrink-0 border-t border-border-default bg-bg-page pb-[env(safe-area-inset-bottom)]">
      {TABS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            `flex flex-1 items-center justify-center text-[13px] ${
              isActive ? 'font-bold text-brand-primary' : 'font-medium text-text-secondary'
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
