import { router } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { Pressable } from 'react-native'
import { COLORS } from '@ev-flow/core/lib/theme'
import { createShadow } from '../lib/shadow'

/** 지도 위에 띄우는 둥근 버튼 그림자 (웹 0 2px 8px 12%) */
export const FLOATING_BUTTON_SHADOW = createShadow(2, 8, 0.12)

type BackButtonProps = {
  /** true면 지도 위에 띄우는 흰 원 모양 (길찾기 화면) */
  floating?: boolean
}

/** 상세 · 검색 화면 헤더의 뒤로가기. 이전 화면이 없으면(딥링크로 바로 연 경우) 지도 홈으로 */
export function BackButton({ floating = false }: BackButtonProps) {
  // 스택에 이전 화면이 있으면 돌아가고, 없으면 홈으로 바꿈
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'))

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="뒤로"
      onPress={goBack}
      hitSlop={8}
      style={floating ? FLOATING_BUTTON_SHADOW : undefined}
      className={`size-10 items-center justify-center ${
        floating ? 'rounded-full bg-bg-page' : '-ml-2'
      }`}
    >
      <ChevronLeft size={24} strokeWidth={2} color={COLORS['text-primary']} />
    </Pressable>
  )
}
