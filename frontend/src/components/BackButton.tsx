import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router'

type BackButtonProps = {
  onClick?: () => void
  /** 지도 위에 띄우는 흰 원형 버튼 (길찾기 화면) */
  floating?: boolean
}

/** 상세 · 검색 화면 헤더의 뒤로가기. 기본 동작은 브라우저 뒤로 */
export function BackButton({ onClick, floating = false }: BackButtonProps) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      aria-label="뒤로"
      onClick={onClick ?? (() => navigate(-1))}
      className={`flex size-10 shrink-0 items-center justify-center text-text-primary ${
        floating ? 'rounded-full bg-bg-page shadow-[0_2px_8px_rgba(0,0,0,0.12)]' : '-ml-2'
      }`}
    >
      <ChevronLeft aria-hidden size={24} strokeWidth={2} />
    </button>
  )
}
