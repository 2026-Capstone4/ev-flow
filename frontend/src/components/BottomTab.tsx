import { Menu, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'

/**
 * 하단 탭 목록. icon이 있으면 글자 대신 아이콘만 보여 주고, 글자는 화면 읽기 프로그램용 이름으로만 씀
 * shiftClass는 글자 위치만 옮기는 값. 누르는 영역은 그대로 둠
 */
const TABS: { to: string; label: string; icon?: LucideIcon; shiftClass?: string }[] = [
  // 도심 충전소 글자를 왼쪽으로 15px 옮김
  { to: '/', label: '도심 충전소', shiftClass: '-translate-x-[15px]' },
  { to: '/service-areas', label: '고속도로 휴게소' },
  { to: '/more', label: '더보기', icon: Menu },
]

/** 앱 BottomTab과 같은 글자 하단 탭 + 오른쪽 끝 더보기 아이콘 */
export function BottomTab() {
  return (
    // 아래 여백은 홈 인디케이터가 있는 기기에서만 그 높이보다 8px 덜 둠 (앱과 같이 탭 영역을 조금 아래로). 브라우저 툴바가 보일 때는 0
    // 왼쪽에도 아이콘 탭 폭(w-16)만큼 여백을 둬서, 글자 탭 두 개가 화면 가운데를 기준으로 좌우 대칭이 되게 함
    <nav className="flex h-[calc(52px+max(calc(env(safe-area-inset-bottom)_-_8px),0px))] shrink-0 border-t border-border-default bg-bg-page pb-[max(calc(env(safe-area-inset-bottom)_-_8px),0px)] pl-16">
      {TABS.map(({ to, label, icon: Icon, shiftClass }) => (
        <NavLink
          key={to}
          to={to}
          end
          aria-label={Icon ? label : undefined}
          // 아이콘 탭은 좁게 두고, 남는 폭은 글자 탭이 나눠 씀
          className={({ isActive }) =>
            `flex items-center justify-center text-[15px] ${Icon ? 'w-16' : 'flex-1'} ${
              isActive ? 'font-bold text-brand-primary' : 'font-medium text-text-secondary'
            }`
          }
        >
          {/* 아이콘 탭이면 아이콘만, 아니면 글자. 아이콘 색은 글자색(currentColor)을 따름 */}
          {({ isActive }) =>
            Icon ? (
              <Icon aria-hidden size={20} strokeWidth={isActive ? 2.5 : 2} />
            ) : (
              <span className={shiftClass}>{label}</span>
            )
          }
        </NavLink>
      ))}
    </nav>
  )
}
