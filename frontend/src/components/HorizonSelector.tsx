import { getHorizonLabel, HORIZONS } from '@ev-flow/core/lib/horizon'
import type { HorizonMinutes } from '@ev-flow/core/types/station'

type HorizonSelectorProps = {
  value: HorizonMinutes
  onChange: (value: HorizonMinutes) => void
  /** floating = 지도 위에 띄우는 작은 토글 / inline = 화면 폭을 채우고 고른 칸을 필터 칩과 같은 파란색으로 */
  variant?: 'floating' | 'inline'
}

const VARIANT_CLASS = {
  floating: {
    // 누르기 쉽게 묶음 높이 40 (칸은 묶음 높이를 채움)
    group: 'h-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.12)]',
    option: 'h-full px-4',
    selected: 'bg-bg-page text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.1)]',
  },
  inline: {
    group: 'w-full',
    option: 'flex-1',
    selected: 'bg-brand-primary text-text-on-brand',
  },
}

export function HorizonSelector({ value, onChange, variant = 'floating' }: HorizonSelectorProps) {
  const style = VARIANT_CLASS[variant]
  return (
    <div
      role="radiogroup"
      aria-label="예측 시점"
      className={`flex items-center gap-1 rounded-md bg-bg-subtle p-1 ${style.group}`}
    >
      {HORIZONS.map((option) => {
        const isSelected = option === value
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option)}
            className={`rounded-sm py-1.5 text-[13px] ${style.option} ${
              isSelected ? `font-bold ${style.selected}` : 'font-medium text-text-secondary'
            }`}
          >
            {getHorizonLabel(option)}
          </button>
        )
      })}
    </div>
  )
}
