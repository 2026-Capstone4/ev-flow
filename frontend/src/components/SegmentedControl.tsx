type SegmentedControlProps<T extends string> = {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  /** 스크린리더용 묶음 이름 (예: 지역) */
  label: string
}

/**
 * 대시보드 지역 · 기간 선택 (Figma 지역필터 96:287 · 기간선택 102:298)
 * 버튼 폭은 가장 긴 글자에 맞춰 모두 같게 나눔
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-grid shrink-0 auto-cols-fr grid-flow-col rounded-md border border-border-default bg-bg-page p-1"
    >
      {options.map((option) => {
        const isSelected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
            className={`rounded-sm px-4 py-1.5 text-[13px] ${
              isSelected
                ? 'bg-brand-primary-bg font-bold text-brand-primary'
                : 'font-medium text-text-secondary'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
