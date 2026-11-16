import { LoaderCircle, LocateFixed } from 'lucide-react'

type LocateButtonProps = {
  /** 위치를 재는 중이면 돌아가는 아이콘을 보이고 다시 누를 수 없게 함 */
  isLocating: boolean
  onClick: () => void
  tabIndex?: number
}

/** 지도 우측 하단 현재 위치 버튼 */
export function LocateButton({ isLocating, onClick, tabIndex }: LocateButtonProps) {
  return (
    <button
      type="button"
      aria-label="현재 위치로 이동"
      aria-busy={isLocating}
      disabled={isLocating}
      tabIndex={tabIndex}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full bg-bg-page text-text-primary shadow-[0_2px_8px_rgba(0,0,0,0.15)] disabled:text-text-secondary"
    >
      {isLocating ? (
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
      ) : (
        <LocateFixed className="size-5" aria-hidden />
      )}
    </button>
  )
}
