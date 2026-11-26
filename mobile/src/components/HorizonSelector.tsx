import { useState } from 'react'
import { Pressable, Text, useWindowDimensions, View } from 'react-native'
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
    // 세 칸을 가장 긴 굵은 글자("지금 출발") 폭에 맞춰 같게 하므로 짧은 칸은 글자 옆이 남아서 좌우 여백을 px-4에서 줄임
    group: 'self-start p-1.5',
    option: 'px-2.5 py-2.5',
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

/**
 * floating 칸 좌우 여백을 줄이는 화면 폭(dp). 이보다 좁으면 "추천 충전소" 옆에 한 줄로 안 들어가 다음 줄로 내려감
 * (Galaxy S20 384dp · iPhone SE 375pt에서 약 6~15dp 모자람. iPhone 17 Pro 402pt · Pixel 411dp는 그대로)
 */
const NARROW_SCREEN_WIDTH = 400

/** 좁은 화면의 floating 칸 좌우 여백. px-2.5보다 칸마다 7씩, 세 칸 합쳐 21 줄어듦 */
const NARROW_FLOATING_OPTION = 'px-1.5 py-2.5'

/** 웹 그림자(0 1px 2px 10%)를 RN 그림자 속성으로 옮김. floating에서 고른 칸만 띄움 */
const FLOATING_SELECTED_SHADOW = createShadow(1, 2, 0.1)

/** 예측 시점(지금 · 15분 후 · 30분 후) 선택 */
export function HorizonSelector({ value, onChange, variant = 'floating' }: HorizonSelectorProps) {
  const style = VARIANT_CLASS[variant]
  const { width } = useWindowDimensions()
  // 좁은 화면이면 floating 칸 좌우 여백만 줄여 추천 시트 헤더 한 줄에 들어가게 함
  const optionClass =
    variant === 'floating' && width < NARROW_SCREEN_WIDTH ? NARROW_FLOATING_OPTION : style.option
  // 칸마다 잰 굵은 글자 폭. 가장 넓은 값을 세 칸 모두의 글자 폭으로 써서 3등분함
  const [labelWidths, setLabelWidths] = useState<number[]>([])
  const labelWidth = labelWidths.length > 0 ? Math.max(...labelWidths) : undefined
  // 같은 값이면 상태를 바꾸지 않아 다시 그리기를 멈춤
  const recordLabelWidth = (index: number, measured: number) => {
    setLabelWidths((previous) => {
      if (previous[index] === measured) return previous
      const next = [...previous]
      next[index] = measured
      return next
    })
  }
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="예측 시점"
      className={`flex-row items-center gap-1 rounded-md bg-bg-subtle ${style.group}`}
    >
      {HORIZONS.map((option, index) => {
        const isSelected = option === value
        const label = getHorizonLabel(option)
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ checked: isSelected }}
            onPress={() => onChange(option)}
            style={isSelected && variant === 'floating' ? FLOATING_SELECTED_SHADOW : undefined}
            className={`items-center justify-center rounded-sm ${optionClass} ${
              isSelected ? style.selectedBox : ''
            }`}
          >
            {/* 고르면 굵어져 글자 폭이 달라지므로 늘 굵은 글자 폭을 자리로 잡아 둠 (Android에서 칸 폭이 바뀌던 문제) */}
            <View style={{ minWidth: labelWidth }} className="items-center">
              <Text
                aria-hidden
                importantForAccessibility="no-hide-descendants"
                onLayout={(event) => recordLabelWidth(index, event.nativeEvent.layout.width)}
                className={`${style.text} self-center font-bold opacity-0`}
              >
                {label}
              </Text>
              <Text
                className={`absolute inset-0 text-center ${style.text} ${
                  isSelected ? `font-bold ${style.selectedText}` : 'font-medium text-text-secondary'
                }`}
              >
                {label}
              </Text>
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}
