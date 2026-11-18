import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  /**
   * 충전소 줄을 눌렀을 때 — 그 충전소의 충전기를 보러 감
   * rowOffset: 누른 줄이 표 보이는 영역 맨 위에서 얼마나 내려와 있었는지 (돌아올 때 같은 자리에 두려고)
   */
  onSelect: (station: AdminStation, rowOffset: number) => void
  /** 충전기를 보고 돌아왔을 때 — 그 줄을 떠날 때 자리로 스크롤하고 잠깐 강조함 */
  returnTo?: StationReturnPoint | null
}

/** 충전기별 보기에서 돌아올 때 다시 찾아갈 충전소 줄과 그 줄의 화면 위치 */
export type StationReturnPoint = { stationId: string; rowOffset: number }

/** 돌아온 줄을 강조해 두는 시간 (ms) */
const HIGHLIGHT_MS = 1500

/** 충전소별 상태 표. 충전기 목록을 충전소로 묶은 결과를 보여 줌. 정렬은 바깥에서 해서 넘겨줌 */
export function AdminStationTable({
  stations,
  updatedAt,
  onSelect,
  returnTo,
}: AdminStationTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [highlightedId, setHighlightedId] = useState(returnTo?.stationId ?? null)

  // 돌아왔으면 그 줄이 떠날 때와 같은 높이에 오도록 스크롤. 화면에 그려지기 전에 맞춰서 튀지 않게
  // 표가 새로 그려질 때(충전소별 보기로 돌아올 때) 한 번만 맞춤
  useLayoutEffect(() => {
    const container = scrollRef.current
    // 돌아온 게 아니면 맨 위에서 시작
    if (!container || !returnTo) return
    const row = container.querySelector<HTMLTableRowElement>(
      `tr[data-station-id="${CSS.escape(returnTo.stationId)}"]`,
    )
    // 지역을 바꿔서 그 충전소가 목록에서 빠졌으면 그냥 맨 위
    if (!row) return
    container.scrollTop = row.offsetTop - returnTo.rowOffset
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 그릴 때만 맞춤 (폴링으로 목록이 바뀌어도 다시 스크롤하지 않음)
  }, [])

  // 강조는 잠깐만 보여 주고 서서히 지움
  useEffect(() => {
    // 강조할 줄이 없으면 할 일 없음
    if (!highlightedId) return
    const timer = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [highlightedId])

  /** 누른 줄의 화면 위치를 재서 함께 넘김 */
  const select = (station: AdminStation, row: HTMLTableRowElement) => {
    const scrollTop = scrollRef.current?.scrollTop ?? 0
    onSelect(station, row.offsetTop - scrollTop)
  }

  return (
    // 충전기별 표와 같은 높이로 고정 — 보기를 바꿔도 패널 크기가 그대로
    <div ref={scrollRef} className="h-[480px] overflow-auto border-y border-border-default">
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
                data-station-id={station.stationId}
                // 줄 어디를 눌러도 이동. 키보드는 충전소명 버튼으로
                onClick={(event) => select(station, event.currentTarget)}
                className={`cursor-pointer border-t border-border-default transition-colors duration-700 first:border-t-0 ${
                  station.stationId === highlightedId ? 'bg-brand-primary-bg' : 'hover:bg-bg-subtle'
                }`}
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
                      const row = event.currentTarget.closest('tr')
                      // 버튼은 늘 줄 안에 있지만 타입상 없을 수도 있어서 확인
                      if (row) select(station, row)
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
