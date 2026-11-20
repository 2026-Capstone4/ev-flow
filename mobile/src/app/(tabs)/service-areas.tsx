import { router, useLocalSearchParams } from 'expo-router'
import { ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useServiceAreaListData } from '@ev-flow/core/hooks/useServiceAreaListData'
import { NO_FORECAST_SERVICE_AREA_LABEL, parseDirection } from '@ev-flow/core/lib/serviceArea'
import type { Direction } from '@ev-flow/core/types/serviceArea'
import { DirectionSelector } from '../../components/DirectionSelector'
import { ServiceAreaCard } from '../../components/ServiceAreaCard'
import { UpdateStatus } from '../../components/UpdateStatus'

/** 상태 표시줄 아래 제목까지 띄우는 여백 */
const TOP_GAP = 16

// 고속도로 휴게소 목록 (하단 탭 두 번째). 데이터는 웹과 같은 core useServiceAreaListData
export default function ServiceAreaListScreen() {
  // 상세에서 돌아와도 고른 방향이 유지되도록 화면 값(?direction=)에 둠
  const params = useLocalSearchParams<{ direction?: string }>()
  const direction = parseDirection(params.direction ?? null)
  const insets = useSafeAreaInsets()
  const { serviceAreas, totalCount, updatedAt, isError, loadState } =
    useServiceAreaListData(direction)

  // 방향을 바꾸면 화면 기록을 쌓지 않고 이 화면의 값만 바꿈
  const changeDirection = (value: Direction) => router.setParams({ direction: value })

  return (
    <ScrollView
      className="flex-1 bg-bg-subtle"
      contentContainerClassName="gap-3 px-4 pb-6"
      contentContainerStyle={{ paddingTop: insets.top + TOP_GAP }}
    >
      <View className="gap-0.5">
        <Text className="font-bold text-[22px] text-text-primary">고속도로 휴게소</Text>
        <Text className="font-sans text-[13px] text-text-secondary">
          천안 구간{totalCount !== undefined && ` ${totalCount}곳`} · 현재 충전기 현황
        </Text>
      </View>
      <DirectionSelector value={direction} onChange={changeDirection} />
      <View className="flex-row items-center justify-between gap-2">
        <UpdateStatus updatedAt={updatedAt} isError={isError} />
        <Text className="flex-shrink-0 font-medium text-xs text-text-secondary">
          {NO_FORECAST_SERVICE_AREA_LABEL}
        </Text>
      </View>

      {/* 받은 목록 · 불러오는 중 · 실패 또는 이 방향에 없음 */}
      {loadState === 'ready' ? (
        <View className="gap-3">
          {serviceAreas?.map((area) => (
            <ServiceAreaCard
              key={`${area.name}-${area.direction}`}
              serviceArea={area}
              onPress={() =>
                router.push({
                  pathname: '/service-areas/detail',
                  params: { name: area.name, direction },
                })
              }
            />
          ))}
        </View>
      ) : loadState === 'loading' ? (
        <View className="h-[120px] rounded-lg bg-bg-page" />
      ) : (
        <Text className="py-12 text-center font-sans text-sm text-text-secondary">
          {loadState === 'error'
            ? '휴게소 정보를 불러오지 못했습니다'
            : '이 방향에는 휴게소가 없습니다'}
        </Text>
      )}
    </ScrollView>
  )
}
