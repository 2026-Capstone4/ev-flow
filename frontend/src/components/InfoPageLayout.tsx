import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'
import { usePageTitle } from '@/hooks/usePageMeta'
import {
  OPERATOR_NAME,
  PRIVACY_PATH,
  SERVICE_NAME,
  SUPPORT_EMAIL,
  SUPPORT_PATH,
} from '@/lib/serviceInfo'

type InfoPageLayoutProps = {
  /** 화면 제목. 브라우저 탭 제목에도 씀 */
  title: string
  description?: ReactNode
  children: ReactNode
}

/**
 * 지원 · 개인정보 처리방침처럼 글만 있는 화면의 틀. 지도 · 하단 탭 없이 로그인 없이 열림
 * 앱에서 외부 브라우저로 열고 PC에서도 읽으므로, 모바일 폭 기준에 최대 폭만 제한함
 */
export function InfoPageLayout({ title, description, children }: InfoPageLayoutProps) {
  usePageTitle(title)

  // 지원 ↔ 처리방침 링크로 넘어오면 앞 화면의 스크롤 위치가 남아 있어서 맨 위부터 보여 줌
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [title])

  return (
    <div className="min-h-dvh bg-bg-page">
      <div className="mx-auto flex max-w-[640px] flex-col gap-8 px-5 pt-10 pb-16">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-bold text-brand-primary">{SERVICE_NAME}</p>
          <h1 className="text-[24px] leading-tight font-bold">{title}</h1>
          {description && (
            <p className="text-[16px] leading-relaxed text-text-secondary">{description}</p>
          )}
        </header>
        <main className="flex flex-col gap-8">{children}</main>
        <footer className="flex flex-col gap-2 border-t border-border-default pt-6 text-[14px] text-text-secondary">
          <nav aria-label="안내 페이지" className="flex gap-4">
            <Link to={SUPPORT_PATH} className="font-medium text-text-primary underline">
              지원
            </Link>
            <Link to={PRIVACY_PATH} className="font-medium text-text-primary underline">
              개인정보 처리방침
            </Link>
          </nav>
          <p>
            운영 {OPERATOR_NAME} · 문의{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}

type InfoSectionProps = {
  title: string
  children: ReactNode
}

/** 안내 화면의 항목 하나 (소제목 + 본문) */
export function InfoSection({ title, children }: InfoSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[18px] font-bold">{title}</h2>
      <div className="flex flex-col gap-3 text-[16px] leading-relaxed">{children}</div>
    </section>
  )
}
