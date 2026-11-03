type FilterChipProps = {
  label: string
  isSelected: boolean
  onClick: () => void
}

export function FilterChip({ label, isSelected, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${
        isSelected
          ? 'border-brand-primary bg-brand-primary font-bold text-text-on-brand'
          : 'border-border-default bg-bg-page font-medium text-text-primary'
      }`}
    >
      {label}
    </button>
  )
}
