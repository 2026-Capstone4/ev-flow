import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router'

type BackButtonProps = {
  onClick?: () => void
}

/** 상세 · 검색 화면 헤더의 뒤로가기. 기본 동작은 브라우저 뒤로 */
export function BackButton({ onClick }: BackButtonProps) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      aria-label="뒤로"
      onClick={onClick ?? (() => navigate(-1))}
      className="-ml-2 flex size-10 shrink-0 items-center justify-center text-text-primary"
    >
      <ChevronLeft aria-hidden size={24} strokeWidth={2} />
    </button>
  )
}
