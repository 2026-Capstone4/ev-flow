import { Pressable } from 'react-native'
import { Text } from './Text'

type FilterChipProps = {
  label: string
  isSelected: boolean
  onPress: () => void
  /** 켜면 흐리게 보이고 누를 수 없음 (상태 이상 화면에서 해당 충전기가 0대인 칩) */
  disabled?: boolean
}

/** 필터 · 정렬 칩. 고르면 파란 바탕에 흰 글자 */
export function FilterChip({ label, isSelected, onPress, disabled = false }: FilterChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected, disabled }}
      onPress={onPress}
      disabled={disabled}
      className={`flex-shrink-0 rounded-full border px-3 py-2 ${
        isSelected ? 'border-brand-primary bg-brand-primary' : 'border-border-default bg-bg-page'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      <Text
        className={`text-[14px] ${
          isSelected ? 'font-bold text-text-on-brand' : 'font-medium text-text-primary'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  )
}
