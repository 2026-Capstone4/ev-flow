import { Text, View } from 'react-native'
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
    <View className="w-full gap-3">
      <View className="h-2 flex-row gap-0.5 overflow-hidden rounded-full bg-bg-subtle">
        {groups.map((group) => (
          <View
            key={group}
            className={GROUP_CLASS[group]}
            style={{ flexGrow: counts[group], flexBasis: 0 }}
          />
        ))}
      </View>
      <View className="flex-row flex-wrap gap-x-3 gap-y-1">
        {groups.map((group) => (
          <View key={group} className="flex-row items-center gap-1.5">
            <View className={`size-2 rounded-full ${GROUP_CLASS[group]}`} />
            <Text className="font-sans text-xs text-text-secondary">
              {CHARGER_STATUS_GROUP_LABEL[group]} {counts[group]}대
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
