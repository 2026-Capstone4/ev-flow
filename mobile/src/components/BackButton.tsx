import { router } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { Pressable } from 'react-native'
import { COLORS } from '@ev-flow/core/lib/theme'

/** 상세 · 검색 화면 헤더의 뒤로가기. 이전 화면이 없으면(딥링크로 바로 연 경우) 지도 홈으로 */
export function BackButton() {
  // 스택에 이전 화면이 있으면 돌아가고, 없으면 홈으로 바꿈
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'))

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="뒤로"
      onPress={goBack}
      hitSlop={8}
      className="-ml-2 size-10 items-center justify-center"
    >
      <ChevronLeft size={24} strokeWidth={2} color={COLORS['text-primary']} />
    </Pressable>
  )
}
