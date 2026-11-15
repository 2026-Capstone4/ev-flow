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
    // 높이는 내용만큼 — 같은 줄 카드끼리는 grid가 높이를 맞춰 주고, 설명 문구는 카드 아래쪽에 붙임
    <section className="flex flex-col gap-1 rounded-lg border border-border-default bg-bg-page p-4 sm:p-5">
      <h2 className="text-[13px] text-text-secondary">{label}</h2>
      {value === null ? (
        <div className="h-9 w-20 animate-pulse rounded-sm bg-bg-subtle" />
      ) : (
        <p className={`text-2xl leading-9 font-bold sm:text-[28px] ${valueClassName}`}>{value}</p>
      )}
      {caption && (
        <p className="mt-auto pt-1 text-xs break-keep text-text-secondary">{caption}</p>
      )}
    </section>
  )
}
