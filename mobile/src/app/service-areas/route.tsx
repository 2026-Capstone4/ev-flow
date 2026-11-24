import { router, useLocalSearchParams } from 'expo-router'
import { ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useServiceAreaRouteData } from '@ev-flow/core/hooks/useServiceAreaRouteData'
import { getRouteLabel, getTowardsNote } from '@ev-flow/core/lib/nationwideServiceArea'
import { NO_FORECAST_SERVICE_AREA_LABEL } from '@ev-flow/core/lib/serviceArea'
import { BackButton } from '../../components/BackButton'
import { RouteBadge } from '../../components/RouteBadge'
import { SegmentedControl } from '../../components/SegmentedControl'
import { ServiceAreaRow } from '../../components/ServiceAreaRow'
import { UpdateStatus } from '../../components/UpdateStatus'

// 노선 화면 (/service-areas/route?name=경부선&heading=부산). 방향을 고르면 그 방향으로 지나가는 순서대로 휴게소를 보여 줌
export default function ServiceAreaRouteScreen() {
  // 상세에서 돌아와도 고른 방향이 유지되도록 화면 값(?heading=)에 둠
  const params = useLocalSearchParams<{ name?: string; heading?: string }>()
  const routeName = params.name ?? ''
  const insets = useSafeAreaInsets()
  const {
    areas,
    headings,
    heading,
    routeNo,
    areaCount,
    availableChargers,
    updatedAt,
    isError,
    loadState,
  } = useServiceAreaRouteData(routeName, params.heading ?? null)
  // 지금 방향의 반대쪽 끝 도시 (예: 부산 방향이면 서울). '서울 → 부산 순서' 안내에 씀
  const origin = headings.find((h) => h !== heading)

  // 방향을 바꾸면 화면 기록을 쌓지 않고 이 화면의 값만 바꿈
  const changeHeading = (value: string) => router.setParams({ heading: value })

  return (
    <View className="flex-1 bg-bg-subtle" style={{ paddingTop: insets.top }}>
      <View className="h-[52px] flex-row items-center gap-2 px-4">
        <BackButton />
        <Text className="font-bold text-[17px] text-text-primary">고속도로 휴게소</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-4 pt-1 pb-6">
        <View className="gap-1">
          <View className="flex-row items-center gap-2">
            <RouteBadge routeNo={routeNo} size="lg" />
            <Text className="flex-shrink font-bold text-[22px] text-text-primary">
              {getRouteLabel(routeName)}고속도로
            </Text>
          </View>
          {/* 노선 전체(두 방향 합계) 숫자는 목록을 받은 뒤에만 */}
          {areaCount !== undefined && (
            <Text className="font-sans text-[13px] text-text-secondary">
              휴게소 {areaCount}곳 · 사용 가능 {availableChargers}기
            </Text>
          )}
        </View>

        {/* 방향 버튼은 노선 끝 도시가 둘인 노선만. 순환선 등은 방향 없이 전체 목록 */}
        {heading && (
          <SegmentedControl
            options={headings.map((h) => ({ value: h, label: `${h} 방향` }))}
            value={heading}
            onChange={changeHeading}
          />
        )}
        <View className="flex-row items-center justify-between gap-2">
          <UpdateStatus updatedAt={updatedAt} isError={isError} />
          <Text className="flex-shrink-0 font-medium text-xs text-text-secondary">
            {NO_FORECAST_SERVICE_AREA_LABEL}
          </Text>
        </View>
        {heading && origin && (
          <Text className="px-1 font-sans text-[13px] text-text-secondary">
            {origin} → {heading} 순서
          </Text>
        )}

        {/* 받은 목록 · 불러오는 중 · 실패 또는 이 노선에 휴게소 없음 */}
        {loadState === 'ready' ? (
          <View className="overflow-hidden rounded-lg bg-bg-page">
            {areas?.map((area, index) => (
              <ServiceAreaRow
                key={area.id}
                serviceArea={area}
                // 방향 탭 안에서는 방향을 뺀 이름, 방향 탭이 없는 노선은 방향이 들어간 이름
                title={heading ? area.shortName : area.name}
                note={area.bidirectional ? '양방향' : getTowardsNote(area, heading)}
                isFirst={index === 0}
                onPress={() =>
                  router.push({ pathname: '/service-areas/detail', params: { id: area.id } })
                }
              />
            ))}
          </View>
        ) : loadState === 'loading' ? (
          <View className="h-[240px] rounded-lg bg-bg-page" />
        ) : (
          <Text className="py-12 text-center font-sans text-sm text-text-secondary">
            {loadState === 'error'
              ? '휴게소 정보를 불러오지 못했습니다'
              : '이 노선에는 휴게소가 없습니다'}
          </Text>
        )}
      </ScrollView>
    </View>
  )
}
