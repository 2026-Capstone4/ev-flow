import { Pressable, Text, View } from 'react-native'
import { formatWaitTime } from '@ev-flow/core/lib/congestion'
import { formatDistance, type StationSearchResult } from '@ev-flow/core/lib/stationSearch'
import { CongestionBadge } from './CongestionBadge'

type SearchResultRowProps = {
  result: StationSearchResult
  onPress: () => void
}

/** 검색 결과 한 줄. 혼잡도는 선택한 예측 시점 기준 */
export function SearchResultRow({ result, onPress }: SearchResultRowProps) {
  const { station, distanceMeters, prediction } = result
  const summary = [
    formatDistance(distanceMeters),
    prediction && formatWaitTime(prediction.waitTimeP50Minutes, prediction.waitTimeP90Minutes),
    `사용 가능 ${station.availableChargers}/${station.totalChargers}대`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-[60px] w-full flex-row items-center gap-3 border-b border-border-default px-4 py-3 active:bg-bg-subtle"
    >
      <View className="min-w-0 flex-1 gap-0.5">
        <Text numberOfLines={1} className="font-bold text-[15px] text-text-primary">
          {station.name}
        </Text>
        <Text numberOfLines={1} className="font-sans text-[13px] text-text-secondary">
          {summary}
        </Text>
      </View>
      {/* 배지가 위로 붙는 모양(self-start)이라 칸으로 감싸 줄 가운데에 둠 */}
      <View>
        <CongestionBadge congestion={prediction?.congestion ?? null} />
      </View>
    </Pressable>
  )
}
