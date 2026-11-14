import type { ReactNode } from 'react'

type FilterChipProps = {
  label: string
  isSelected: boolean
  onClick: () => void
  /** 글자 뒤에 붙는 아이콘 (예: 정렬 방향 화살표) */
  icon?: ReactNode
}

export function FilterChip({ label, isSelected, onClick, icon }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] ${
        isSelected
          ? 'border-brand-primary bg-brand-primary font-bold text-text-on-brand'
          : 'border-border-default bg-bg-page font-medium text-text-primary'
      }`}
    >
      {label}
      {icon}
    </button>
  )
}
