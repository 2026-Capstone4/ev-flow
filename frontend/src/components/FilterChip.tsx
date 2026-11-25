import type { ReactNode } from 'react'

type FilterChipProps = {
  label: string
  isSelected: boolean
  onClick: () => void
  /** 글자 뒤에 붙는 아이콘 (예: 정렬 방향 화살표) */
  icon?: ReactNode
  /** 켜면 흐리게 보이고 누를 수 없음 (상태 이상 화면에서 해당 충전기가 0대인 칩) */
  disabled?: boolean
}

export function FilterChip({
  label,
  isSelected,
  onClick,
  icon,
  disabled = false,
}: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[14px] admin:text-[13px] ${
        isSelected
          ? 'border-brand-primary bg-brand-primary font-bold text-text-on-brand'
          : 'border-border-default bg-bg-page font-medium text-text-primary'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {label}
      {icon}
    </button>
  )
}
