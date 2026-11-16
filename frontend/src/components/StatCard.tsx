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
      {/* 설명 자리를 미리 잡아 불러온 뒤 카드 높이가 바뀌지 않게 함
          모바일은 카드가 좁아 설명이 두 줄까지 되므로 두 줄(36px), 그보다 넓으면 한 줄
          설명이 없을 때 넣는 빈칸은 스크린리더가 읽지 않게 숨김 */}
      <p
        aria-hidden={!caption}
        className="mt-auto min-h-9 pt-1 text-xs break-keep text-text-secondary sm:min-h-0"
      >
        {caption ?? ' '}
      </p>
    </section>
  )
}
