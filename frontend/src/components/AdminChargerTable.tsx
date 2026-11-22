import { InfoTooltip } from '@/components/InfoTooltip'
import { getAdminChargerStatusLabel, TODAY_OCCUPANCY_TOOLTIP } from '@/lib/admin/chargerStatus'
import { CHARGER_REGION_LABEL, formatPercent, formatStatUpdated } from '@/lib/admin/common'
import type { AdminCharger } from '@/types/admin'
import type { ChargerStatus } from '@ev-flow/core/types/station'

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
  /** 목록 기준 시각 — 상태 갱신 시각이 다른 날이면 날짜를 붙이는 기준 */
  updatedAt: Date
}

/** 충전기 상태 표 (ADM-002). 정렬은 바깥에서 해서 넘겨줌 */
export function AdminChargerTable({ chargers, updatedAt }: AdminChargerTableProps) {
  return (
    // 표 높이를 10줄 정도로 고정하고 안에서 스크롤 — 검색으로 줄 수가 바뀌어도 패널 크기는 그대로. 머리글은 위에 고정
    <div className="h-[480px] overflow-auto border-y border-border-default">
      <table className="w-full min-w-[640px] text-left text-sm whitespace-nowrap">
        {/* z-10: 아래로 펼쳐지는 ⓘ 말풍선이 표 줄에 가려지지 않게 */}
        <thead className="sticky top-0 z-10 bg-bg-subtle text-[13px] text-text-secondary shadow-[0_1px_0_var(--color-border-default)]">
          <tr>
            <th className="px-5 py-2.5 font-medium">구분</th>
            <th className="px-5 py-2.5 font-medium">충전소 / 휴게소</th>
            <th className="px-5 py-2.5 font-medium">충전기</th>
            <th className="px-5 py-2.5 font-medium">상태</th>
            <th className="px-5 py-2.5 font-medium">
              <span className="inline-flex items-center gap-1">
                오늘 이용률
                <InfoTooltip text={TODAY_OCCUPANCY_TOOLTIP} label="오늘 이용률 설명" />
              </span>
            </th>
            <th className="px-5 py-2.5 font-medium">상태 갱신(운영사)</th>
          </tr>
        </thead>
        <tbody>
          {chargers.map((charger) => {
            const at = charger.statUpdatedAt ? new Date(charger.statUpdatedAt) : null
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
                {/* 운영사가 보내는 시각이라 수집이 끊긴 것으로 오해하지 않게 빨간 표시 · 경과 시간 없이 시각만. 값이 없으면 대시 */}
                <td className="px-5 py-3 text-text-secondary">
                  {at ? formatStatUpdated(at, updatedAt) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
