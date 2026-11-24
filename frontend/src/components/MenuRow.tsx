import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

type MenuSectionProps = {
  title: string
  children: ReactNode
}

/** 더보기 화면의 항목 묶음. 회색 바탕 위에 제목과 흰 카드 하나로 보여 줌 */
export function MenuSection({ title, children }: MenuSectionProps) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[13px] font-semibold text-text-secondary">{title}</h2>
      <div className="overflow-hidden rounded-lg bg-bg-page">{children}</div>
    </section>
  )
}

type MenuRowProps = {
  label: string
  /** 오른쪽에 보여 줄 값. 있으면 화살표 대신 값만 보여 줌 */
  value?: string
  /** 사이트 안 화면 주소. 있으면 그 화면으로 감 */
  to?: string
  /** 메일 등 바깥 주소. to가 없을 때만 씀 */
  href?: string
  /** 누를 때 할 일. to · href가 없을 때만 씀 */
  onClick?: () => void
  /** 묶음의 첫 줄이면 위 구분선을 그리지 않음 */
  isFirst?: boolean
}

/** 왼쪽 글자 · 오른쪽 화살표(또는 값) 한 줄 */
export function MenuRow({ label, value, to, href, onClick, isFirst = false }: MenuRowProps) {
  const className = `flex min-h-[52px] w-full items-center justify-between gap-3 px-4 text-left ${
    isFirst ? '' : 'border-t border-border-default'
  }`
  const content = (
    <>
      <span className="flex-1 text-[15px] font-medium text-text-primary">{label}</span>
      {/* 값이 있으면 값만, 누를 수 있는 줄이면 화살표를 붙임 */}
      {value !== undefined ? (
        <span className="text-[15px] text-text-secondary">{value}</span>
      ) : (
        <ChevronRight aria-hidden size={20} strokeWidth={2} className="text-text-secondary" />
      )}
    </>
  )

  // 사이트 안 화면이면 Link, 바깥 주소면 a, 할 일만 있으면 button, 셋 다 없으면 눌리지 않는 줄
  if (to) {
    return (
      <Link to={to} className={`${className} active:bg-bg-subtle`}>
        {content}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={`${className} active:bg-bg-subtle`}>
        {content}
      </a>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} active:bg-bg-subtle`}>
        {content}
      </button>
    )
  }
  return <div className={className}>{content}</div>
}
