import { Check, ChevronDown } from 'lucide-react-native'
import { useState } from 'react'
import { FlatList, Modal, Pressable, Text, View } from 'react-native'
import Animated, { SlideInDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { DistrictIssueCount } from '@ev-flow/core/lib/chargerIssues'
import { COLORS } from '@ev-flow/core/lib/theme'

type DistrictPickerProps = {
  value: string
  /** 구마다 확인 불가 대수. 아직 못 받았으면 버튼을 눌러도 목록을 열지 않음 */
  districts: DistrictIssueCount[] | undefined
  onChange: (district: string) => void
}

/** 상태 이상 충전기 화면의 구 선택. 버튼을 누르면 아래에서 구 목록이 올라옴 */
export function DistrictPicker({ value, districts, onChange }: DistrictPickerProps) {
  const insets = useSafeAreaInsets()
  const [isOpen, setIsOpen] = useState(false)

  /** 고른 구를 알리고 목록을 닫음 */
  const select = (district: string) => {
    onChange(district)
    setIsOpen(false)
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`지역 선택, 지금 ${value}`}
        disabled={!districts}
        onPress={() => setIsOpen(true)}
        hitSlop={4}
        className="flex-row items-center gap-1 rounded-full border border-border-default bg-bg-page py-1.5 pr-2.5 pl-3 active:opacity-70"
      >
        <Text className="font-bold text-sm text-text-primary">{value}</Text>
        <ChevronDown size={16} color={COLORS['text-secondary']} />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        // 'slide'는 회색 배경까지 같이 올라와서 어색함. 창 전체는 흐려지게 열고, 목록만 아래에서 올림
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <View className="flex-1 justify-end">
          {/* 목록 바깥을 누르면 고르지 않고 닫음 */}
          <Pressable
            accessibilityLabel="지역 선택 닫기"
            onPress={() => setIsOpen(false)}
            className="absolute inset-0 bg-text-primary/25"
          />
          {/* 열릴 때 목록만 아래에서 올라옴. 닫을 때는 창 전체가 함께 흐려짐 */}
          <Animated.View
            entering={SlideInDown.duration(250)}
            className="max-h-[70%] rounded-t-lg bg-bg-page pt-4"
            style={{ paddingBottom: insets.bottom }}
          >
            <Text className="px-5 pb-2 font-bold text-base text-text-primary">지역 선택</Text>
            <FlatList
              data={districts}
              keyExtractor={(item) => item.district}
              renderItem={({ item }) => {
                const isSelected = item.district === value
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => select(item.district)}
                    className="flex-row items-center gap-2 px-5 py-3 active:bg-bg-subtle"
                  >
                    <Text
                      className={`flex-1 text-[16px] ${
                        isSelected
                          ? 'font-bold text-brand-primary'
                          : 'font-medium text-text-primary'
                      }`}
                    >
                      {item.district}
                    </Text>
                    {/* 확인 불가 충전기가 있는 구만 대수를 보여 줌 */}
                    {item.count > 0 && (
                      <Text className="font-sans text-[14px] text-text-secondary">
                        확인 불가 {item.count}기
                      </Text>
                    )}
                    <View className="w-5 items-end">
                      {isSelected && <Check size={18} color={COLORS['brand-primary']} />}
                    </View>
                  </Pressable>
                )
              }}
            />
          </Animated.View>
        </View>
      </Modal>
    </>
  )
}
