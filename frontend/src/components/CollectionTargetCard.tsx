import { CollectionHealthLabel } from '@/components/CollectionHealthLabel'
import { CHARGER_REGION_LABEL, type CollectionHealth } from '@/lib/admin'
import { formatClock, formatElapsed } from '@/lib/formatUpdatedAt'
import type { CollectionTarget } from '@/types/admin'

type CollectionTargetCardProps = {
  target: CollectionTarget & { health: CollectionHealth }
  now: Date
}

/** 수집 대상(도심 · 휴게소) 하나의 마지막 수집 · 실패 · 응답 지연 (ADM-003) */
export function CollectionTargetCard({ target, now }: CollectionTargetCardProps) {
  const lastSuccess = target.lastSuccessAt ? new Date(target.lastSuccessAt) : null
  const rows = [
    {
      label: '마지막 성공',
      value: lastSuccess
        ? `${formatClock(lastSuccess)} (${formatElapsed(lastSuccess, now)})`
        : '기록 없음',
    },
    { label: '오늘 실패 · 부분 성공', value: `${target.failedRunsToday}회` },
    {
      label: 'API 응답',
      value: `${target.lastApiLatencyMs ?? '—'}ms (오늘 평균 ${target.averageApiLatencyMsToday ?? '—'}ms)`,
    },
  ]

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border-default px-4 py-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-bold">{CHARGER_REGION_LABEL[target.target]} 수집</h3>
        <span className="text-[13px]">
          <CollectionHealthLabel health={target.health} />
        </span>
      </header>
      <dl className="flex flex-col gap-1.5 text-[13px]">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3">
            <dt className="shrink-0 text-text-secondary">{row.label}</dt>
            <dd className="text-right">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
