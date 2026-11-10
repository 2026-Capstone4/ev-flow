import { CHARGER_STATUS_LABEL, formatChargerSpec, formatChargingElapsed } from '@/lib/charger'
import type { ChargerDetail, ChargerStatus } from '@/types/station'

// TODO(fe): Figma에 운영 중지 · 확인 불가 색 추가 후 맞춤 (지금은 점검 중 · 확인 불가 배지 색을 빌려 씀)
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
}

export function ChargerRow({ charger, now }: ChargerRowProps) {
  const elapsed = formatChargingElapsed(charger.chargingStartedAt, now)
  return (
    <li className="flex items-center justify-between gap-2 border-b border-border-default px-4 py-3 last:border-b-0">
      {/* 커넥터가 여럿인 충전기(DC차데모/AC3상/DC콤보)는 한 줄에 안 들어가서 말줄임 대신 줄바꿈. 단어 중간은 끊지 않음 */}
      <span className="min-w-0 text-sm font-medium break-keep">
        급속 {charger.chargerId} · {formatChargerSpec(charger.connectorTypes, charger.capacityKw)}
      </span>
      <span className={`shrink-0 text-[13px] font-bold ${STATUS_CLASS[charger.status]}`}>
        {CHARGER_STATUS_LABEL[charger.status]}
        {elapsed && ` · ${elapsed}`}
      </span>
    </li>
  )
}
