import { Pressable, Text, View } from 'react-native'
import { DIRECTION_LABEL } from '@ev-flow/core/lib/serviceArea'
import type { Direction } from '@ev-flow/core/types/serviceArea'

const OPTIONS: Direction[] = ['up', 'down']

type DirectionSelectorProps = {
  value: Direction
  onChange: (value: Direction) => void
}

/** 휴게소 상행(서울 방향) · 하행(부산 방향) 선택 */
export function DirectionSelector({ value, onChange }: DirectionSelectorProps) {
  return (
    <View
      accessibilityRole="radiogroup"
      className="h-10 w-full flex-row gap-1 rounded-md bg-bg-subtle p-1"
    >
      {OPTIONS.map((option) => {
        const isSelected = option === value
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            onPress={() => onChange(option)}
            // 웹 그림자(0 1px 2px 10%)를 RN 그림자 속성으로 옮김
            style={
              isSelected
                ? {
                    shadowColor: '#000',
                    shadowOpacity: 0.1,
                    shadowRadius: 1,
                    shadowOffset: { width: 0, height: 1 },
                  }
                : undefined
            }
            className={`flex-1 items-center justify-center rounded-sm ${isSelected ? 'bg-bg-page' : ''}`}
          >
            <Text
              className={`text-sm ${
                isSelected ? 'font-bold text-text-primary' : 'font-medium text-text-secondary'
              }`}
            >
              {DIRECTION_LABEL[option]}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
