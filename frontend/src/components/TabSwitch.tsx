type TabSwitchProps<T extends string> = {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  /** 스크린리더용 묶음 이름 (예: 보기 방식) */
  label: string
}

/** 회색 바탕 위에 고른 칸만 흰색으로 띄우는 선택 버튼 묶음 (휴게소 노선별 · 지역별, 노선 방향). 앱 SegmentedControl과 같은 모양 */
export function TabSwitch<T extends string>({
  options,
  value,
  onChange,
  label,
}: TabSwitchProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex h-11 w-full shrink-0 gap-1 rounded-md bg-bg-subtle p-1"
    >
      {options.map((option) => {
        const isSelected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-sm text-[16px] ${
              isSelected
                ? 'bg-bg-page font-bold text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.1)]'
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
