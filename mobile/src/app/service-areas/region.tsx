import { router, useLocalSearchParams } from 'expo-router'
import { ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useServiceAreaRegionData } from '@ev-flow/core/hooks/useServiceAreaRegionData'
import { NO_FORECAST_SERVICE_AREA_LABEL } from '@ev-flow/core/lib/serviceArea'
import { BackButton } from '../../components/BackButton'
import { RouteBadge } from '../../components/RouteBadge'
import { ServiceAreaRow } from '../../components/ServiceAreaRow'
import { UpdateStatus } from '../../components/UpdateStatus'

// 지역 화면 (/service-areas/region?code=41). 한 시도의 휴게소를 노선별 소제목으로 묶고, 노선 미확인은 맨 아래
// code=unmatched면 노선 미확인 휴게소를 시도별 소제목으로 묶음 (노선별 탭의 '노선 미확인' 줄)
// 방향 탭이 없어서 휴게소 이름은 방향이 들어간 name을 씀
export default function ServiceAreaRegionScreen() {
  const params = useLocalSearchParams<{ code?: string }>()
  const insets = useSafeAreaInsets()
  const { title, sections, areaCount, availableChargers, updatedAt, isError, loadState } =
    useServiceAreaRegionData(params.code ?? '')

  return (
    <View className="flex-1 bg-bg-subtle" style={{ paddingTop: insets.top }}>
      <View className="h-[52px] flex-row items-center gap-2 px-4">
        <BackButton />
        <Text className="font-bold text-[18px] text-text-primary">고속도로 휴게소</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-4 pt-1 pb-6">
        <View className="gap-1">
          <Text className="font-bold text-[22px] text-text-primary">{title}</Text>
          {/* 휴게소 수 · 사용 가능 수는 목록을 받은 뒤에만 */}
          {areaCount !== undefined && (
            <Text className="font-sans text-[14px] text-text-secondary">
              휴게소 {areaCount}곳 · 사용 가능 {availableChargers}기
            </Text>
          )}
        </View>
        <View className="flex-row items-center justify-between gap-2">
          <UpdateStatus updatedAt={updatedAt} isError={isError} />
          <Text className="flex-shrink-0 font-medium text-xs text-text-secondary">
            {NO_FORECAST_SERVICE_AREA_LABEL}
          </Text>
        </View>

        {/* 받은 목록 · 불러오는 중 · 실패 또는 이 지역에 휴게소 없음 */}
        {loadState === 'ready' ? (
          sections?.map((section) => (
            <View key={section.title} className="gap-2">
              <View className="flex-row items-center gap-2 px-1 pt-2">
                <RouteBadge routeNo={section.routeNo} />
                <Text className="font-bold text-[16px] text-text-primary">{section.title}</Text>
                <Text className="font-sans text-[14px] text-text-secondary">
                  {section.areas.length}곳
                </Text>
              </View>
              <View className="overflow-hidden rounded-lg bg-bg-page">
                {section.areas.map((area, index) => (
                  <ServiceAreaRow
                    key={area.id}
                    serviceArea={area}
                    title={area.name}
                    note={area.bidirectional ? '양방향' : null}
                    isFirst={index === 0}
                    onPress={() =>
                      router.push({ pathname: '/service-areas/detail', params: { id: area.id } })
                    }
                  />
                ))}
              </View>
            </View>
          ))
        ) : loadState === 'loading' ? (
          <View className="h-[240px] rounded-lg bg-bg-page" />
        ) : (
          <Text className="py-12 text-center font-sans text-sm text-text-secondary">
            {loadState === 'error'
              ? '휴게소 정보를 불러오지 못했습니다'
              : '이 지역에는 휴게소가 없습니다'}
          </Text>
        )}
      </ScrollView>
    </View>
  )
}
