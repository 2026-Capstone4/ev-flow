import type { ReactNode } from 'react'

type CenteredPageProps = {
  /** 가운데 기둥의 배경색 클래스 (예: bg-bg-subtle). 기둥 밖 여백은 body 배경 */
  bgClassName: string
  /** 위에 고정되는 머리 (뒤로가기 헤더 등) */
  header?: ReactNode
  /** 아래에 고정되는 꼬리 (하단 탭 · 길찾기 버튼 등) */
  footer?: ReactNode
  /** 스크롤되는 본문 기둥의 클래스 (여백 · 간격) */
  contentClassName: string
  children: ReactNode
}

/**
 * 가운데 430px 기둥 화면의 틀. 스크롤 영역은 창 전체 폭이라 기둥 옆 여백에 마우스를 두고 휠을 굴려도 본문이 움직임
 * (기둥 안에만 스크롤 영역을 두면 넓은 창에서 여백 위 휠이 아무것도 못 움직임)
 */
export function CenteredPage({
  bgClassName,
  header,
  footer,
  contentClassName,
  children,
}: CenteredPageProps) {
  return (
    <div className="flex h-dvh flex-col">
      {header && (
        <div className={`mx-auto w-full max-w-[430px] shrink-0 ${bgClassName}`}>{header}</div>
      )}
      <main className="flex-1 overflow-y-auto">
        <div className={`mx-auto min-h-full max-w-[430px] ${bgClassName} ${contentClassName}`}>
          {children}
        </div>
      </main>
      {footer && (
        <div className={`mx-auto w-full max-w-[430px] shrink-0 ${bgClassName}`}>{footer}</div>
      )}
    </div>
  )
}
