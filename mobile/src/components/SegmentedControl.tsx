import { Pressable, Text, View } from 'react-native'

type SegmentedControlProps<T extends string> = {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

/** 회색 바탕 위에 고른 칸만 흰색으로 띄우는 선택 버튼 묶음 (휴게소 노선별 · 지역별, 노선 방향) */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="radiogroup"
      className="h-10 w-full flex-row gap-1 rounded-md bg-bg-subtle p-1"
    >
      {options.map((option) => {
        const isSelected = option.value === value
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            onPress={() => onChange(option.value)}
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
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
