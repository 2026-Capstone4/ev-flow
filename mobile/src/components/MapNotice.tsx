import { View } from 'react-native'
import { KoreanText } from './KoreanText'

type MapNoticeProps = {
  message: string
}

/** 지도 위에 잠깐 띄우는 안내 (예: 위치 권한 거부). 긴 문구는 줄을 바꿔서 둥근 정도를 줄임 */
export function MapNotice({ message }: MapNoticeProps) {
  return (
    <View
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      className="max-w-full rounded-2xl bg-text-primary/85 px-3 py-1.5"
    >
      <KoreanText className="font-medium text-xs text-text-on-brand">{message}</KoreanText>
    </View>
  )
}
