import { useNow } from '@ev-flow/core/hooks/useNow'
import { useStationsQuery } from '@ev-flow/core/hooks/useStationsQuery'
import { getUpdateStatusText } from '@ev-flow/core/lib/formatUpdatedAt'
import { Zap } from 'lucide-react-native'
import { ActivityIndicator, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '@ev-flow/core/lib/theme'

// 2단계 골격 확인용 첫 화면. core 쿼리 훅 · 폰트 · 아이콘 · 색 토큰이 앱에서 도는지 봄
// 3단계(지도 검증)에서 지도 홈 화면으로 바꿈
export default function HomeScreen() {
  const stationsQuery = useStationsQuery()
  const now = useNow()
  const updatedAt = stationsQuery.data ? new Date(stationsQuery.data.updatedAt) : null
  const statusText = getUpdateStatusText(updatedAt, stationsQuery.isError, now)

  return (
    <SafeAreaView className="flex-1 bg-bg-page">
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <Zap color={COLORS['brand-primary']} size={40} />
        <Text className="font-bold text-2xl text-text-primary">EV-flow</Text>
        {/* 처음 받는 중이면 로딩 표시, 받았으면 충전소 수, 실패했는데 마지막 값도 없으면 아무것도 안 띄움 */}
        {stationsQuery.isPending ? (
          <ActivityIndicator color={COLORS['brand-primary']} />
        ) : stationsQuery.data ? (
          <Text className="font-medium text-base text-text-primary">
            충전소 {stationsQuery.data.stations.length.toLocaleString()}곳
          </Text>
        ) : null}
        {/* 갱신 시각 또는 실패 안내. 실패해도 마지막 정상값 시각이 있으면 함께 보여 줌 */}
        {statusText && (
          <Text
            className={`font-sans text-sm ${stationsQuery.isError ? 'text-status-warning' : 'text-text-secondary'}`}
          >
            {statusText}
          </Text>
        )}
      </View>
    </SafeAreaView>
  )
}
