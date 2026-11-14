import type { ReactNode } from 'react'

type StatCardProps = {
  label: string
  /** 큰 숫자 · 상태 문구. 아직 못 받았으면 null → 자리만 표시 */
  value: ReactNode | null
  /** 값 글자색 (예: text-brand-primary) */
  valueClassName?: string
  caption?: string
}

/** 대시보드 상단 요약 카드 (전체 충전기 · 이용률 · 고장 · 데이터 수집) */
export function StatCard({
  label,
  value,
  valueClassName = 'text-text-primary',
  caption,
}: StatCardProps) {
  return (
    <section className="flex flex-col gap-1 rounded-lg border border-border-default bg-bg-page px-5 py-5">
      <h2 className="text-[13px] text-text-secondary">{label}</h2>
      {value === null ? (
        <div className="h-9 w-20 animate-pulse rounded-sm bg-bg-subtle" />
      ) : (
        <p className={`text-[28px] leading-9 font-bold ${valueClassName}`}>{value}</p>
      )}
      {caption && <p className="text-xs text-text-secondary">{caption}</p>}
    </section>
  )
}
