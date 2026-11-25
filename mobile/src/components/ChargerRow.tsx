import { Text, View } from 'react-native'
import {
  CHARGER_STATUS_LABEL,
  formatChargerSpec,
  formatChargingElapsed,
} from '@ev-flow/core/lib/charger'
import type { ChargerDetail, ChargerStatus } from '@ev-flow/core/types/station'

// 웹 ChargerRow와 같은 상태 글자색
const STATUS_CLASS: Record<ChargerStatus, string> = {
  available: 'text-congestion-free',
  charging: 'text-status-charging',
  stopped: 'text-status-warning',
  maintenance: 'text-status-warning',
  unknown: 'text-congestion-unknown',
}

type ChargerRowProps = {
  charger: ChargerDetail
  now: Date
  /** 목록 마지막 줄이면 아래 구분선을 뺌 (RN에는 last: 선택자가 없음) */
  isLast: boolean
}

export function ChargerRow({ charger, now, isLast }: ChargerRowProps) {
  const elapsed = formatChargingElapsed(charger.chargingStartedAt, now)
  return (
    <View
      className={`flex-row items-center justify-between gap-2 px-4 py-3 ${
        isLast ? '' : 'border-b border-border-default'
      }`}
    >
      {/* 커넥터가 여럿인 충전기는 한 줄에 안 들어가서 줄바꿈. 한글 단어 중간은 끊지 않음 */}
      <Text
        lineBreakStrategyIOS="hangul-word"
        className="min-w-0 flex-shrink font-medium text-sm text-text-primary"
      >
        급속 {charger.chargerId} · {formatChargerSpec(charger.connectorTypes, charger.capacityKw)}
      </Text>
      <Text className={`flex-shrink-0 font-bold text-[14px] ${STATUS_CLASS[charger.status]}`}>
        {CHARGER_STATUS_LABEL[charger.status]}
        {elapsed && ` · ${elapsed}`}
      </Text>
    </View>
  )
}
