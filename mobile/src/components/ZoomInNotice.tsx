import { ZoomIn } from 'lucide-react-native'
import { Text, View } from 'react-native'
import { COLORS } from '@ev-flow/core/lib/theme'

/** 지도를 너무 멀리 봐서 충전소 마커를 숨긴 동안 띄우는 확대 안내. 회색 지도 위에서도 눈에 띄게 브랜드 색으로 칠함 */
export function ZoomInNotice() {
  return (
    <View
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      }}
      className="flex-row items-center gap-1.5 rounded-full bg-brand-primary px-4 py-2.5"
    >
      <ZoomIn size={16} strokeWidth={2.5} color={COLORS['text-on-brand']} />
      <Text className="font-semibold text-sm text-text-on-brand">확대하면 충전소가 보여요</Text>
    </View>
  )
}
