import { Pressable, Text, View } from 'react-native'
import { getHorizonLabel, HORIZONS } from '@ev-flow/core/lib/horizon'
import type { HorizonMinutes } from '@ev-flow/core/types/station'

type HorizonSelectorProps = {
  value: HorizonMinutes
  onChange: (value: HorizonMinutes) => void
}

/**
 * 예측 시점(지금 · 15분 후 · 30분 후) 선택. 웹 HorizonSelector의 inline 모양
 * 지도 위에 띄우는 floating 모양은 지도 홈을 옮길 때 더함
 */
export function HorizonSelector({ value, onChange }: HorizonSelectorProps) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="예측 시점"
      className="w-full flex-row items-center gap-1 rounded-md bg-bg-subtle p-1"
    >
      {HORIZONS.map((option) => {
        const isSelected = option === value
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            onPress={() => onChange(option)}
            className={`flex-1 items-center rounded-sm py-1.5 ${isSelected ? 'bg-brand-primary' : ''}`}
          >
            <Text
              className={`text-[13px] ${
                isSelected ? 'font-bold text-text-on-brand' : 'font-medium text-text-secondary'
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
