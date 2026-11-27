import { CHARGER_ISSUE_LABEL, type ChargerIssue } from '@/lib/admin/chargerIssues'
import type { ChargerIssueKind } from '@/lib/admin/chargerIssues'
import { TableMoreRow } from '@/components/TableMoreRow'
import { useShownCount } from '@/hooks/useShownCount'
import { chargerRegionLabel } from '@/lib/admin/common'
import { formatClock } from '@ev-flow/core/lib/formatUpdatedAt'

/**
 * '상태 갱신(운영사)' 칸 안내. 이 값은 우리가 수집한 시각이 아니라 운영사가 보내는 statUpdDt라
 * 수집이 잘 되고 있어도 몇 시간 · 며칠 전일 수 있음 (운영사마다 기준이 다름)
 * 표가 짧으면 말풍선이 스크롤 영역에 잘려서 표 아래에 늘 보이게 둠
 */
const STAT_UPDATED_NOTE =
  '상태 갱신(운영사)은 운영사가 보내는 시각이라 참고용이에요. 우리가 수집한 시각과는 달라요.'

/** 상태 갱신 시각 문구. 목록 기준 시각과 날짜가 다르면 날짜를 앞에 붙임 (예: 11/20 14:05) */
function formatStatUpdated(at: Date, reference: Date) {
  // 같은 날이면 시각만
  if (at.toDateString() === reference.toDateString()) return formatClock(at)
  return `${at.getMonth() + 1}/${at.getDate()} ${formatClock(at)}`
}

/** 종류 글자색. 바로 조치할 통신 이상은 빨강, 미확인은 주황, 원래 오가는 불안정은 회색 */
const KIND_CLASS: Record<ChargerIssueKind, string> = {
  communication: 'text-congestion-busy',
  unconfirmed: 'text-status-warning',
  other: 'text-text-primary',
  unstable: 'text-text-secondary',
}

type AdminChargerIssueTableProps = {
  issues: ChargerIssue[]
  /** 목록 기준 시각 — 상태 갱신 시각이 다른 날이면 날짜를 붙이는 기준 */
  updatedAt: Date
  /** 이 값이 바뀌면(지역 · 구 · 종류 칩) 더보기로 늘린 줄 수를 처음으로 되돌림 */
  resetKey: string
}

/** 상태 이상 충전기 표. 정렬 · 거르기는 바깥에서 해서 넘겨줌 (운영 현황 충전기 표와 같은 모양) */
export function AdminChargerIssueTable({
  issues,
  updatedAt,
  resetKey,
}: AdminChargerIssueTableProps) {
  // 아래 빈 목록 안내보다 먼저 불러야 함 (훅은 조건 없이 늘 같은 순서로)
  const { shown, remaining, showMore } = useShownCount(issues.length, resetKey)
  // 고른 종류에 충전기가 없으면 표 대신 안내
  if (issues.length === 0) {
    return (
      <p className="mx-5 rounded-md bg-bg-subtle py-10 text-center text-sm text-text-secondary">
        지금은 해당하는 충전기가 없습니다
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 표 높이를 고정하고 안에서 스크롤. 머리글은 위에 고정 */}
      <div className="max-h-[560px] overflow-auto border-y border-border-default">
        <table className="w-full min-w-[640px] text-left text-sm whitespace-nowrap">
          <thead className="sticky top-0 z-10 bg-bg-subtle text-[13px] text-text-secondary shadow-[0_1px_0_var(--color-border-default)]">
            <tr>
              <th className="px-5 py-2.5 font-medium">구분</th>
              <th className="px-5 py-2.5 font-medium">충전소 / 휴게소</th>
              <th className="px-5 py-2.5 font-medium">충전기</th>
              <th className="px-5 py-2.5 font-medium">종류</th>
              <th className="px-5 py-2.5 font-medium">원본 코드</th>
              <th className="px-5 py-2.5 font-medium">상태 갱신(운영사)</th>
            </tr>
          </thead>
          <tbody>
            {issues.slice(0, shown).map(({ charger, kind }) => {
              const at = charger.statUpdatedAt ? new Date(charger.statUpdatedAt) : null
              return (
                <tr
                  key={`${charger.region}-${charger.stationId}-${charger.chargerId}`}
                  className="border-t border-border-default first:border-t-0"
                >
                  <td className="px-5 py-3 text-text-secondary">{chargerRegionLabel(charger)}</td>
                  <td className="px-5 py-3">{charger.stationName}</td>
                  <td className="px-5 py-3 text-text-secondary">{charger.chargerId}번</td>
                  <td className={`px-5 py-3 font-bold ${KIND_CLASS[kind]}`}>
                    {CHARGER_ISSUE_LABEL[kind]}
                  </td>
                  {/* 마지막 성공 수집에 그 충전기 행이 없으면 원본 코드가 없음 */}
                  <td className="px-5 py-3 text-text-secondary tabular-nums">
                    {charger.stat ?? '—'}
                  </td>
                  {/* 수집이 끊긴 것으로 오해하지 않게 빨간 표시 · 경과 시간 없이 시각만. 값이 없으면 '—' */}
                  <td className="px-5 py-3 text-text-secondary tabular-nums">
                    {at ? formatStatUpdated(at, updatedAt) : '—'}
                  </td>
                </tr>
              )
            })}
            <TableMoreRow colSpan={6} shown={shown} remaining={remaining} onMore={showMore} />
          </tbody>
        </table>
      </div>
      <p className="px-5 text-xs text-text-secondary">{STAT_UPDATED_NOTE}</p>
    </div>
  )
}
