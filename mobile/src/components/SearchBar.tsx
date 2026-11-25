import { Search } from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'
import { COLORS } from '@ev-flow/core/lib/theme'

type SearchBarProps = {
  onSearchPress: () => void
  onFilterPress: () => void
  /** 적용 중인 필터 조건 수. 0이면 숫자를 숨김 */
  activeFilterCount: number
  /** 필터 패널이 열려 있는지. 열려 있으면 필터 버튼을 눌린 모양으로 */
  isFilterOpen: boolean
}

/** 웹 그림자(0 2px 8px 12%)를 RN 그림자 속성으로 옮김 */
const SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.12,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 2 },
}

/** 지도 홈 상단 검색창. 왼쪽은 검색 화면으로 이동, 오른쪽 필터는 지도 위 필터 패널을 엶 */
export function SearchBar({
  onSearchPress,
  onFilterPress,
  activeFilterCount,
  isFilterOpen,
}: SearchBarProps) {
  return (
    <View style={SHADOW} className="w-full flex-row items-center rounded-md bg-bg-page">
      <Pressable
        accessibilityRole="search"
        onPress={onSearchPress}
        className="min-w-0 flex-1 flex-row items-center gap-2 py-4 pl-4"
      >
        <Search size={20} strokeWidth={2} color={COLORS['text-secondary']} />
        <Text numberOfLines={1} className="flex-1 font-sans text-[17px] text-text-secondary">
          충전소 이름 · 주소 검색
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isFilterOpen }}
        onPress={onFilterPress}
        hitSlop={4}
        className={`mx-2 rounded-sm px-2.5 py-2 ${isFilterOpen ? 'bg-brand-primary-bg' : ''}`}
      >
        <Text className="font-bold text-[16px] text-brand-primary">
          필터{activeFilterCount > 0 && ` ${activeFilterCount}`}
        </Text>
      </Pressable>
    </View>
  )
}
