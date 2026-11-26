import { ChevronRight } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from './Text'
import { COLORS } from '@ev-flow/core/lib/theme'

type MenuSectionProps = {
  title: string
  children: ReactNode
}

/** 더보기 화면의 항목 묶음. 회색 바탕 위에 제목과 흰 카드 하나로 보여 줌 */
export function MenuSection({ title, children }: MenuSectionProps) {
  return (
    <View className="gap-2">
      <Text className="px-1 font-semibold text-[14px] text-text-secondary">{title}</Text>
      <View className="overflow-hidden rounded-lg bg-bg-page">{children}</View>
    </View>
  )
}

type MenuRowProps = {
  label: string
  /** 오른쪽에 보여 줄 값 (예: 버전). 있으면 화살표 대신 값만 보여 줌 */
  value?: string
  /** 누를 때 할 일. 없으면 눌리지 않는 줄 */
  onPress?: () => void
  /** 묶음의 첫 줄이면 위 구분선을 그리지 않음 */
  isFirst?: boolean
}

/** 왼쪽 글자 · 오른쪽 화살표(또는 값) 한 줄 */
export function MenuRow({ label, value, onPress, isFirst = false }: MenuRowProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      disabled={!onPress}
      onPress={onPress}
      className={`min-h-[52px] flex-row items-center justify-between gap-3 px-4 active:bg-bg-subtle ${
        isFirst ? '' : 'border-t border-border-default'
      }`}
    >
      <Text className="flex-1 font-medium text-[16px] text-text-primary">{label}</Text>
      {/* 값이 있으면 값만, 누를 수 있는 줄이면 화살표를 붙임 */}
      {value !== undefined ? (
        <Text className="font-sans text-[16px] text-text-secondary">{value}</Text>
      ) : (
        onPress && <ChevronRight size={20} strokeWidth={2} color={COLORS['text-secondary']} />
      )}
    </Pressable>
  )
}
