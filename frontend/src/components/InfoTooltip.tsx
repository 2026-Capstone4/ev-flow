import { Info } from 'lucide-react'
import { useId, useState } from 'react'

type InfoTooltipProps = {
  /** 말풍선에 보여 줄 설명 */
  text: string
  /** 아이콘 버튼의 이름 (화면 낭독기용, 예: '오늘 이용률 설명') */
  label: string
}

/**
 * ⓘ 아이콘 + 설명 말풍선. 마우스를 올리거나 키보드로 초점을 주면 보이고,
 * 터치 화면에서는 눌러서 열고 닫음. 말풍선은 아이콘 아래로 펼쳐짐
 */
export function InfoTooltip({ text, label }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const tooltipId = useId()

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={(event) => {
          // Esc로 말풍선만 닫음 (초점은 그대로)
          if (event.key === 'Escape') setIsOpen(false)
        }}
        className="inline-flex text-text-secondary"
      >
        <Info size={14} aria-hidden />
      </button>
      {/* 열렸을 때만 말풍선을 그림 */}
      {isOpen && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute top-full left-1/2 z-20 mt-1.5 w-60 -translate-x-1/2 rounded-md bg-text-primary px-3 py-2 text-left break-keep whitespace-normal text-xs leading-relaxed font-normal text-text-on-brand shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  )
}
