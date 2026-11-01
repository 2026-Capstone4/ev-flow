import { NavLink } from 'react-router'

const TABS = [
  { to: '/', label: '도심 충전소' },
  { to: '/rest-areas', label: '고속도로 휴게소' },
]

export function BottomTab() {
  return (
    <nav className="flex h-[72px] shrink-0 border-t border-border-default bg-bg-page pb-4">
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
