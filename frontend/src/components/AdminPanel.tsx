import type { ReactNode } from 'react'

/**
 * 운영자 화면의 흰 카드 틀 — 제목 오른쪽에 부가 설명 · 버튼을 둘 수 있음
 * 제목이 문자열이면 h2로, 그 밖(전환 버튼 등)이면 받은 그대로 제목 자리에 둠
 */
export function AdminPanel({
  title,
  aside,
  children,
}: {
  title: ReactNode
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-lg border border-border-default bg-bg-page py-5">
      <header className="flex flex-wrap items-center justify-between gap-2 px-5">
        {typeof title === 'string' ? <h2 className="text-[15px] font-bold">{title}</h2> : title}
        {aside}
      </header>
      {children}
    </section>
  )
}

/** 데이터가 없을 때 자리 표시 — 처음 불러오는 중이면 회색 상자, 실패면 안내 문구 */
export function AdminPlaceholder({
  isError,
  height = 180,
  heightClassName,
}: {
  isError: boolean
  height?: number
  /** 화면 폭마다 높이가 다를 때 height 대신 쓰는 Tailwind 높이 클래스 */
  heightClassName?: string
}) {
  // 높이 클래스를 받았으면 그것을, 아니면 숫자 높이를 씀
  const style = heightClassName ? undefined : { height }
  // 실패하고 보여 줄 이전 값도 없으면 안내 문구 (폴링이 다음 주기에 다시 시도함)
  if (isError) {
    return (
      <p
        className={`flex items-center justify-center px-5 text-sm text-text-secondary ${heightClassName ?? ''}`}
        style={style}
      >
        불러오지 못했습니다 · 잠시 후 자동으로 다시 시도합니다
      </p>
    )
  }
  return (
    <div
      className={`mx-5 animate-pulse rounded-md bg-bg-subtle ${heightClassName ?? ''}`}
      style={style}
    />
  )
}

/** 범례용 색 네모 — 차트 막대와 같은 색을 글자 대신 보여 줌 */
export function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="inline-block size-2.5 shrink-0 rounded-[2px] align-[-1px]"
      style={{ backgroundColor: color }}
    />
  )
}

/** 운영자 화면 맨 위 제목 줄 — 왼쪽 제목 · 설명, 오른쪽 필터 */
export function AdminPageHeader({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-bold">{title}</h1>
        <p className="text-[13px] text-text-secondary">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </header>
  )
}
