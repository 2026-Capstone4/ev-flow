import { CHARGER_ISSUE_LABEL, type ChargerIssue } from '@/lib/admin/chargerIssues'
import type { ChargerIssueKind } from '@/lib/admin/chargerIssues'
import { CHARGER_REGION_LABEL, isStale } from '@/lib/admin/common'
import { formatClock, formatElapsed } from '@ev-flow/core/lib/formatUpdatedAt'

/** 종류 글자색. 바로 조치할 통신 이상은 빨강, 미확인은 주황, 원래 오가는 불안정은 회색 */
const KIND_CLASS: Record<ChargerIssueKind, string> = {
  communication: 'text-congestion-busy',
  unconfirmed: 'text-status-warning',
  other: 'text-text-primary',
  unstable: 'text-text-secondary',
}

type AdminChargerIssueTableProps = {
  issues: ChargerIssue[]
  /** 목록 기준 시각 — 수신 시각이 이보다 20분 넘게 오래되면 빨갛게 표시 */
  updatedAt: Date
}

/** 상태 이상 충전기 표. 정렬 · 거르기는 바깥에서 해서 넘겨줌 (운영 현황 충전기 표와 같은 모양) */
export function AdminChargerIssueTable({ issues, updatedAt }: AdminChargerIssueTableProps) {
  // 고른 종류에 충전기가 없으면 표 대신 안내
  if (issues.length === 0) {
    return (
      <p className="mx-5 rounded-md bg-bg-subtle py-10 text-center text-sm text-text-secondary">
        지금은 해당하는 충전기가 없습니다
      </p>
    )
  }

  return (
    // 표 높이를 고정하고 안에서 스크롤. 머리글은 위에 고정
    <div className="max-h-[560px] overflow-auto border-y border-border-default">
      <table className="w-full min-w-[640px] text-left text-sm whitespace-nowrap">
        <thead className="sticky top-0 z-10 bg-bg-subtle text-[13px] text-text-secondary shadow-[0_1px_0_var(--color-border-default)]">
          <tr>
            <th className="px-5 py-2.5 font-medium">구분</th>
            <th className="px-5 py-2.5 font-medium">충전소 / 휴게소</th>
            <th className="px-5 py-2.5 font-medium">충전기</th>
            <th className="px-5 py-2.5 font-medium">종류</th>
            <th className="px-5 py-2.5 font-medium">원본 코드</th>
            <th className="px-5 py-2.5 font-medium">마지막 수신</th>
          </tr>
        </thead>
        <tbody>
          {issues.map(({ charger, kind }) => {
            const at = charger.statUpdatedAt ? new Date(charger.statUpdatedAt) : null
            const stale = isStale(charger.statUpdatedAt, updatedAt)
            return (
              <tr
                key={`${charger.region}-${charger.stationId}-${charger.chargerId}`}
                className="border-t border-border-default first:border-t-0"
              >
                <td className="px-5 py-3 text-text-secondary">
                  {CHARGER_REGION_LABEL[charger.region]}
                </td>
                <td className="px-5 py-3">{charger.stationName}</td>
                <td className="px-5 py-3 text-text-secondary">{charger.chargerId}번</td>
                <td className={`px-5 py-3 font-bold ${KIND_CLASS[kind]}`}>
                  {CHARGER_ISSUE_LABEL[kind]}
                </td>
                {/* 마지막 성공 수집에 그 충전기 행이 없으면 원본 코드가 없음 */}
                <td className="px-5 py-3 text-text-secondary tabular-nums">
                  {charger.stat ?? '—'}
                </td>
                <td
                  className={`px-5 py-3 tabular-nums ${stale ? 'text-congestion-busy' : 'text-text-secondary'}`}
                >
                  {/* 20분 넘게 오래된 수신은 얼마나 지났는지 같이 보여 줌. 수신 기록이 없으면 '—' */}
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
