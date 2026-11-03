import { DIRECTION_LABEL } from '@/lib/serviceArea'
import type { Direction } from '@/types/serviceArea'

const OPTIONS: Direction[] = ['up', 'down']

type DirectionSelectorProps = {
  value: Direction
  onChange: (value: Direction) => void
}

/** 휴게소 상행(서울 방향) · 하행(부산 방향) 선택 */
export function DirectionSelector({ value, onChange }: DirectionSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="방향"
      className="flex h-10 w-full gap-1 rounded-md bg-bg-subtle p-1"
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
            className={`flex-1 rounded-sm text-sm ${
              isSelected
                ? 'bg-bg-page font-bold text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.1)]'
                : 'font-medium text-text-secondary'
            }`}
          >
            {DIRECTION_LABEL[option]}
          </button>
        )
      })}
    </div>
  )
}
