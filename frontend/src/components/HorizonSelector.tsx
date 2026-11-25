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
    // 네이버 지도 패널 탭처럼 묶음 높이 46 · 글자 15.5 (칸은 묶음 높이를 채움)
    group: 'h-[46px] p-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.12)]',
    option: 'h-full px-4 py-2 text-[15.5px]',
    selected: 'bg-bg-page text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.1)]',
  },
  inline: {
    // 묶음 여백 6 = 묶음 라운드 md(12) - 칸 라운드 sm(6)이라 두 모서리가 나란히 돎
    group: 'w-full p-1.5',
    option: 'flex-1 py-1.5 text-[15px]',
    selected: 'bg-brand-primary text-text-on-brand',
  },
}

export function HorizonSelector({ value, onChange, variant = 'floating' }: HorizonSelectorProps) {
  const style = VARIANT_CLASS[variant]
  return (
    <div
      role="radiogroup"
      aria-label="예측 시점"
      className={`flex items-center gap-1 rounded-md bg-bg-subtle ${style.group}`}
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
            className={`rounded-sm ${style.option} ${
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
