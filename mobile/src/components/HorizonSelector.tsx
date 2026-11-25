import { Pressable, Text, View } from 'react-native'
import { getHorizonLabel, HORIZONS } from '@ev-flow/core/lib/horizon'
import type { HorizonMinutes } from '@ev-flow/core/types/station'
import { createShadow } from '../lib/shadow'

type HorizonSelectorProps = {
  value: HorizonMinutes
  onChange: (value: HorizonMinutes) => void
  /** floating = 추천 시트 헤더의 작은 토글 / inline = 화면 폭을 채우고 고른 칸을 필터 칩과 같은 파란색으로 */
  variant?: 'floating' | 'inline'
}

// RN은 글자색이 View에서 Text로 물려지지 않아 칸 · 글자를 나눠 둠
const VARIANT_CLASS = {
  floating: {
    // 네이버 지도 패널 탭처럼 묶음 높이 약 45 · 글자 15.5. 높이를 고정하지 않아 글자 크기를 키우면 함께 커짐
    group: 'self-start p-1.5',
    option: 'px-4 py-2.5',
    text: 'text-[15.5px]',
    selectedBox: 'bg-bg-page',
    selectedText: 'text-text-primary',
  },
  inline: {
    // 묶음 높이를 정하지 않아서 칸 위아래 여백으로 높이를 냄 (h-full을 쓰면 화면 끝까지 늘어남)
    // 묶음 여백 6 = 묶음 라운드 md(12) - 칸 라운드 sm(6)이라 두 모서리가 나란히 돎
    group: 'w-full p-1.5',
    option: 'flex-1 py-1.5',
    text: 'text-[15px]',
    selectedBox: 'bg-brand-primary',
    selectedText: 'text-text-on-brand',
  },
}

/** 웹 그림자(0 1px 2px 10%)를 RN 그림자 속성으로 옮김. floating에서 고른 칸만 띄움 */
const FLOATING_SELECTED_SHADOW = createShadow(1, 2, 0.1)

/** 예측 시점(지금 · 15분 후 · 30분 후) 선택 */
export function HorizonSelector({ value, onChange, variant = 'floating' }: HorizonSelectorProps) {
  const style = VARIANT_CLASS[variant]
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="예측 시점"
      className={`flex-row items-center gap-1 rounded-md bg-bg-subtle ${style.group}`}
    >
      {HORIZONS.map((option) => {
        const isSelected = option === value
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            onPress={() => onChange(option)}
            style={isSelected && variant === 'floating' ? FLOATING_SELECTED_SHADOW : undefined}
            className={`items-center justify-center rounded-sm ${style.option} ${
              isSelected ? style.selectedBox : ''
            }`}
          >
            <Text
              className={`${style.text} ${
                isSelected ? `font-bold ${style.selectedText}` : 'font-medium text-text-secondary'
              }`}
            >
              {getHorizonLabel(option)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
