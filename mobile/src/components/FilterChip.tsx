import { Pressable, Text } from 'react-native'

type FilterChipProps = {
  label: string
  isSelected: boolean
  onPress: () => void
}

/** 필터 · 정렬 칩. 고르면 파란 바탕에 흰 글자 */
export function FilterChip({ label, isSelected, onPress }: FilterChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      className={`flex-shrink-0 rounded-full border px-3 py-1.5 ${
        isSelected ? 'border-brand-primary bg-brand-primary' : 'border-border-default bg-bg-page'
      }`}
    >
      <Text
        className={`text-[13px] ${
          isSelected ? 'font-bold text-text-on-brand' : 'font-medium text-text-primary'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  )
}
