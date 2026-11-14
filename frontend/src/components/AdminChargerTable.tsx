import {
  CHARGER_REGION_LABEL,
  formatPercent,
  getAdminChargerStatusLabel,
  isStale,
} from '@/lib/admin'
import { formatClock, formatElapsed } from '@/lib/formatUpdatedAt'
import type { AdminCharger } from '@/types/admin'
import type { ChargerStatus } from '@/types/station'

// 사용자 화면 ChargerRow와 같은 색. 확인 불가만 운영자가 바로 봐야 해서 빨강으로 강조
const STATUS_CLASS: Record<ChargerStatus, string> = {
  available: 'text-congestion-free',
  charging: 'text-status-charging',
  stopped: 'text-status-warning',
  maintenance: 'text-status-warning',
  unknown: 'text-congestion-busy',
}

type AdminChargerTableProps = {
  chargers: AdminCharger[]
  /** 목록 기준 시각 — 수신 시각이 이보다 20분 넘게 오래되면 빨갛게 표시 */
  updatedAt: Date
}

/** 충전기 상태 표 (ADM-002). 정렬은 바깥에서 해서 넘겨줌 */
export function AdminChargerTable({ chargers, updatedAt }: AdminChargerTableProps) {
  return (
    // 충전기가 수십 기라 표 높이를 제한하고 안에서 스크롤. 머리글은 위에 고정
    <div className="max-h-[480px] overflow-auto border-y border-border-default">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="sticky top-0 bg-bg-subtle text-[13px] text-text-secondary shadow-[0_1px_0_var(--color-border-default)]">
          <tr>
            <th className="px-5 py-2.5 font-medium">구분</th>
            <th className="px-5 py-2.5 font-medium">충전소 / 휴게소</th>
            <th className="px-5 py-2.5 font-medium">충전기</th>
            <th className="px-5 py-2.5 font-medium">상태</th>
            <th className="px-5 py-2.5 font-medium">오늘 이용률</th>
            <th className="px-5 py-2.5 font-medium">마지막 수신</th>
          </tr>
        </thead>
        <tbody>
          {chargers.map((charger) => {
            const at = charger.statUpdatedAt ? new Date(charger.statUpdatedAt) : null
            const stale = isStale(charger.statUpdatedAt, updatedAt)
            return (
              <tr
                key={`${charger.stationId}-${charger.chargerId}`}
                className="border-t border-border-default first:border-t-0"
              >
                <td className="px-5 py-3 text-text-secondary">
                  {CHARGER_REGION_LABEL[charger.region]}
                </td>
                <td className="px-5 py-3">{charger.stationName}</td>
                <td className="px-5 py-3 text-text-secondary">{charger.chargerId}번</td>
                <td className={`px-5 py-3 font-bold ${STATUS_CLASS[charger.status]}`}>
                  {getAdminChargerStatusLabel(charger)}
                </td>
                <td className="px-5 py-3">{formatPercent(charger.todayOccupancyRate)}</td>
                <td
                  className={`px-5 py-3 ${stale ? 'text-congestion-busy' : 'text-text-secondary'}`}
                >
                  {/* 수신 기록이 없으면 대시, 20분 넘게 오래됐으면 몇 분 전인지 함께 표시 */}
                  {at
                    ? `${formatClock(at)}${stale ? ` (${formatElapsed(at, updatedAt)})` : ''}`
                    : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
