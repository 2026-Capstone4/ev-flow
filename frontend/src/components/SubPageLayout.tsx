import type { ReactNode } from 'react'
import { BackButton } from '@/components/BackButton'
import { usePageTitle } from '@/hooks/usePageMeta'

type SubPageLayoutProps = {
  title: string
  children: ReactNode
}

/** 더보기에서 들어가는 글 화면의 틀. 상세 화면과 같은 뒤로가기 헤더 + 스크롤 본문 */
export function SubPageLayout({ title, children }: SubPageLayoutProps) {
  usePageTitle(title)

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col bg-bg-page">
      <header className="flex h-[52px] shrink-0 items-center gap-2 px-4">
        <BackButton />
        <h1 className="text-[17px] font-bold text-text-primary">{title}</h1>
      </header>
      <main className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pt-2 pb-[calc(24px+env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  )
}

type InfoBlockProps = {
  title: string
  children: ReactNode
}

/** 소제목 + 설명 글 한 묶음 */
export function InfoBlock({ title, children }: InfoBlockProps) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-base font-bold text-text-primary">{title}</h2>
      <p className="text-sm leading-[21px] text-text-secondary">{children}</p>
    </section>
  )
}
