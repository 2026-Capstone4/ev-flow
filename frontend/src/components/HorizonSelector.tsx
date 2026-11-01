import type { HorizonMinutes } from '@/types/station'

const OPTIONS: HorizonMinutes[] = [15, 30, 60]

type HorizonSelectorProps = {
  value: HorizonMinutes
  onChange: (value: HorizonMinutes) => void
}

export function HorizonSelector({ value, onChange }: HorizonSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="예측 시점"
      className="flex h-8 items-center gap-1 rounded-md bg-bg-subtle p-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.12)]"
    >
      {OPTIONS.map((option) => {
        const isSelected = option === value
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option)}
            className={`rounded-sm px-4 py-1.5 text-[13px] ${
              isSelected
                ? 'bg-bg-page font-bold text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.1)]'
                : 'font-medium text-text-secondary'
            }`}
          >
            {option}분 후
          </button>
        )
      })}
    </div>
  )
}
