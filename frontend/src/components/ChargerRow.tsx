import { CHARGER_STATUS_LABEL, formatChargerSpec, formatChargingElapsed } from '@/lib/charger'
import type { ChargerDetail, ChargerStatus } from '@/types/station'

// TODO(fe): Figma에 운영 중지 · 확인 불가 색 추가 후 맞춤 (지금은 점검 중 · 확인 불가 배지 색을 빌려 씀)
const STATUS_CLASS: Record<ChargerStatus, string> = {
  available: 'text-congestion-free',
  charging: 'text-text-secondary',
  stopped: 'text-status-warning',
  maintenance: 'text-status-warning',
  unknown: 'text-congestion-unknown',
}

type ChargerRowProps = {
  charger: ChargerDetail
  now: Date
}

export function ChargerRow({ charger, now }: ChargerRowProps) {
  const elapsed = formatChargingElapsed(charger.chargingStartedAt, now)
  return (
    <li className="flex items-center justify-between gap-2 border-b border-border-default px-4 py-3 last:border-b-0">
      <span className="min-w-0 truncate text-sm font-medium">
        급속 {charger.chargerId} · {formatChargerSpec(charger.connectorTypes, charger.capacityKw)}
      </span>
      <span className={`shrink-0 text-[13px] font-bold ${STATUS_CLASS[charger.status]}`}>
        {CHARGER_STATUS_LABEL[charger.status]}
        {elapsed && ` · ${elapsed}`}
      </span>
    </li>
  )
}
