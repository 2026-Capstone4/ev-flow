import {
  CHARGER_STATUS_GROUP_LABEL,
  countChargerStatusGroups,
  type ChargerStatusGroup,
} from '@ev-flow/core/lib/charger'
import type { ChargerStatus } from '@ev-flow/core/types/station'

/** 막대 순서 */
const GROUPS: ChargerStatusGroup[] = ['available', 'charging', 'offline', 'unknown']

// 충전기 행(ChargerRow) 상태 글자색과 같은 색
const GROUP_CLASS: Record<ChargerStatusGroup, string> = {
  available: 'bg-congestion-free',
  charging: 'bg-status-charging',
  offline: 'bg-status-warning',
  unknown: 'bg-congestion-unknown',
}

type ChargerStatusBarProps = {
  statuses: ChargerStatus[]
}

/** 충전기 상태 비율 막대와 범례. 상세 화면 "지금 사용 가능"에서 씀 */
export function ChargerStatusBar({ statuses }: ChargerStatusBarProps) {
  const counts = countChargerStatusGroups(statuses)
  // 0대인 묶음은 막대 · 범례에서 뺌
  const groups = GROUPS.filter((group) => counts[group] > 0)

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-bg-subtle" aria-hidden>
        {groups.map((group) => (
          <div
            key={group}
            className={GROUP_CLASS[group]}
            style={{ flexGrow: counts[group], flexBasis: 0 }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary">
        {groups.map((group) => (
          <li key={group} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${GROUP_CLASS[group]}`} aria-hidden />
            {CHARGER_STATUS_GROUP_LABEL[group]} {counts[group]}대
          </li>
        ))}
      </ul>
    </div>
  )
}
