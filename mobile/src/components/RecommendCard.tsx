import { Pressable, Text, View } from 'react-native'
import { formatWaitTime } from '@ev-flow/core/lib/congestion'
import type { Recommendation } from '@ev-flow/core/types/station'
import { CongestionBadge } from './CongestionBadge'

/**
 * 추천 카드 기본 높이. 로딩 자리표시도 같은 값을 써서 데이터가 와도 시트 크기가 그대로임
 * 글이 길어도 높이가 변하지 않게 카드 안 글은 모두 한 줄로 자름. 글자 크기를 키우면 그만큼 커짐
 */
export const RECOMMEND_CARD_HEIGHT = 136

type RecommendCardProps = {
  recommendation: Recommendation
  onPress: () => void
  /** 길찾기 버튼을 누를 때. 없으면 버튼을 그리지 않음 */
  onRoutePress?: () => void
}

/** 추천 충전소 카드. 대기는 범위(P50~P90)로 표시하고 신뢰도는 표시하지 않음 */
export function RecommendCard({ recommendation, onPress, onRoutePress }: RecommendCardProps) {
  const { rank, station, congestion, travelTimeMinutes, travelTimeSource, reason } = recommendation
  const summary = [
    // 길찾기 실패로 직선거리 추정이면 근사값임을 표시
    `이동 ${travelTimeSource === 'estimate' ? '약 ' : ''}${travelTimeMinutes}분`,
    formatWaitTime(
      recommendation.waitTimeP50Minutes,
      recommendation.waitTimeP90Minutes,
      recommendation.congestion,
    ),
    `사용 가능 ${station.availableChargers}/${station.totalChargers}대`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      // 기본 글자 크기에선 웹과 같은 높이. 앱 글자 줄 높이가 웹보다 조금 작아서 칸 사이를 고르게 벌려 채움
      // iOS 글자 크기를 키우면 잘리지 않게 높이를 고정하지 않고 최소 높이로 둠 (시트가 첫 카드를 재서 접힘 높이를 정함)
      style={{ minHeight: RECOMMEND_CARD_HEIGHT }}
      className="w-full justify-between gap-2 rounded-lg border border-border-default bg-bg-page p-4 active:bg-bg-subtle"
    >
      <View className="w-full flex-row items-center gap-2">
        {/* 글자 크기를 키우면 원도 같이 커지게 최소 크기로 둠 */}
        <View className="min-h-6 min-w-6 items-center justify-center rounded-full bg-brand-primary px-1">
          <Text className="font-bold text-[13px] text-text-on-brand">{rank}</Text>
        </View>
        <Text numberOfLines={1} className="min-w-0 flex-1 font-bold text-base text-text-primary">
          {station.name}
        </Text>
        <CongestionBadge congestion={congestion} className="h-8" />
        {/* RN은 Pressable 안에 Pressable을 둘 수 있어서 웹처럼 카드 위에 겹쳐 띄우지 않고 첫 줄에 바로 넣음 */}
        {onRoutePress && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${station.name} 길찾기`}
            onPress={onRoutePress}
            // 혼잡도 태그와 높이 · 모서리 · 글자 크기를 맞추고 색만 채워 버튼임을 구분함 (웹 w-14)
            className="h-8 w-14 items-center justify-center rounded-sm bg-brand-primary active:opacity-80"
          >
            <Text className="font-bold text-xs text-text-on-brand">길찾기</Text>
          </Pressable>
        )}
      </View>
      {/* 아래 추천 이유 글과 시작 위치를 맞추려고 같은 좌우 여백(px-3)을 줌 */}
      <Text numberOfLines={1} className="w-full px-3 font-sans text-sm text-text-primary">
        {summary}
      </Text>
      <View className="w-full rounded-sm bg-brand-primary-bg px-3 py-2">
        <Text numberOfLines={1} className="font-medium text-[13px] text-brand-primary">
          {reason}
        </Text>
      </View>
    </Pressable>
  )
}

/** 추천을 불러오는 동안 카드 자리에 그리는 회색 상자. 카드와 높이가 같음 (움직임 없이) */
export function RecommendCardSkeleton() {
  return (
    <View style={{ height: RECOMMEND_CARD_HEIGHT }} className="w-full rounded-lg bg-bg-subtle" />
  )
}
