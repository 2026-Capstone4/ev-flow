import { Platform } from 'react-native'

/**
 * 화면 맨 아래 버튼 영역(상세 · 길찾기 시트)의 아래 여백
 * iOS는 insets.bottom이 비어 보이는 홈 인디케이터 자리라 최소 여백과 둘 중 큰 값만 씀
 * Android는 insets.bottom이 내비게이션 바 높이와 같아서 그대로 쓰면 버튼이 바에 붙음 → 바 위에 최소 여백을 더함
 */
export function getFooterPaddingBottom(insetBottom: number, minPadding: number) {
  // Android는 내비게이션 바 위로 최소 여백만큼 더 띄움
  if (Platform.OS === 'android') return insetBottom + minPadding
  return Math.max(minPadding, insetBottom)
}
