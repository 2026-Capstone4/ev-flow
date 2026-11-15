import { InfoTooltip } from '@/components/InfoTooltip'
import {
  CURRENT_OCCUPANCY_TOOLTIP,
  formatStationIssues,
  formatStationOccupancy,
  type AdminStation,
} from '@/lib/admin/chargerStatus'
import { CHARGER_REGION_LABEL, isStale } from '@/lib/admin/common'
import { formatClock, formatElapsed } from '@/lib/formatUpdatedAt'

type AdminStationTableProps = {
  stations: AdminStation[]
  /** 목록 기준 시각 — 수신 시각이 이보다 20분 넘게 오래되면 빨갛게 표시 */
  updatedAt: Date
  /** 충전소 줄을 눌렀을 때 — 그 충전소의 충전기를 보러 감 */
  onSelect: (station: AdminStation) => void
}

/** 충전소별 상태 표. 충전기 목록을 충전소로 묶은 결과를 보여 줌. 정렬은 바깥에서 해서 넘겨줌 */
export function AdminStationTable({ stations, updatedAt, onSelect }: AdminStationTableProps) {
  return (
    // 충전기별 표와 같은 높이로 고정 — 보기를 바꿔도 패널 크기가 그대로
    <div className="h-[480px] overflow-auto border-y border-border-default">
      <table className="w-full min-w-[720px] text-left text-sm whitespace-nowrap">
        {/* z-10: 아래로 펼쳐지는 ⓘ 말풍선이 표 줄에 가려지지 않게 */}
        <thead className="sticky top-0 z-10 bg-bg-subtle text-[13px] text-text-secondary shadow-[0_1px_0_var(--color-border-default)]">
          <tr>
            <th className="px-5 py-2.5 font-medium">구분</th>
            <th className="px-5 py-2.5 font-medium">충전소 / 휴게소</th>
            <th className="px-5 py-2.5 font-medium">충전기</th>
            <th className="px-5 py-2.5 font-medium">
              <span className="inline-flex items-center gap-1">
                현재 이용률
                <InfoTooltip text={CURRENT_OCCUPANCY_TOOLTIP} label="현재 이용률 설명" />
              </span>
            </th>
            <th className="px-5 py-2.5 font-medium">이상</th>
            <th className="px-5 py-2.5 font-medium">마지막 수신</th>
          </tr>
        </thead>
        <tbody>
          {stations.map((station) => {
            const at = station.statUpdatedAt ? new Date(station.statUpdatedAt) : null
            const stale = isStale(station.statUpdatedAt, updatedAt)
            const issues = formatStationIssues(station)
            return (
              <tr
                key={station.stationId}
                // 줄 어디를 눌러도 이동. 키보드는 충전소명 버튼으로
                onClick={() => onSelect(station)}
                className="cursor-pointer border-t border-border-default first:border-t-0 hover:bg-bg-subtle"
              >
                <td className="px-5 py-3 text-text-secondary">
                  {CHARGER_REGION_LABEL[station.region]}
                </td>
                <td className="px-5 py-3">
                  <button
                    type="button"
                    aria-label={`${station.stationName} 충전기 보기`}
                    onClick={(event) => {
                      // 줄의 onClick과 두 번 실행되지 않게 여기서 멈춤
                      event.stopPropagation()
                      onSelect(station)
                    }}
                    className="text-left hover:underline"
                  >
                    {station.stationName}
                  </button>
                </td>
                <td className="px-5 py-3 text-text-secondary">{station.chargerCount}기</td>
                <td className="px-5 py-3">{formatStationOccupancy(station.occupancy)}</td>
                {/* 이상이 있으면 빨강, 없으면 회색 '없음' */}
                <td
                  className={`px-5 py-3 ${issues ? 'font-bold text-congestion-busy' : 'text-text-secondary'}`}
                >
                  {issues ?? '없음'}
                </td>
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
