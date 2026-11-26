import type { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { Text } from './Text'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BackButton } from './BackButton'

type SubPageLayoutProps = {
  title: string
  children: ReactNode
}

/** 더보기에서 들어가는 글 화면의 틀. 상세 화면과 같은 뒤로가기 헤더 + 스크롤 본문 */
export function SubPageLayout({ title, children }: SubPageLayoutProps) {
  const insets = useSafeAreaInsets()
  return (
    <View className="flex-1 bg-bg-page" style={{ paddingTop: insets.top }}>
      <View className="h-[52px] flex-row items-center gap-2 px-4">
        <BackButton />
        <Text className="font-bold text-[18px] text-text-primary">{title}</Text>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-4 pt-2"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {children}
      </ScrollView>
    </View>
  )
}

type InfoBlockProps = {
  title: string
  children: ReactNode
}

/** 소제목 + 설명 글 한 묶음 */
export function InfoBlock({ title, children }: InfoBlockProps) {
  return (
    <View className="gap-1.5">
      <Text className="font-bold text-base text-text-primary">{title}</Text>
      <Text className="font-sans text-sm leading-[21px] text-text-secondary">{children}</Text>
    </View>
  )
}
