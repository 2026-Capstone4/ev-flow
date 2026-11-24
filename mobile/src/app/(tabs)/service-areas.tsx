import { router, useLocalSearchParams } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useServiceAreaRoutesData } from '@ev-flow/core/hooks/useServiceAreaRoutesData'
import type { RouteSummary } from '@ev-flow/core/lib/nationwideServiceArea'
import { NO_FORECAST_SERVICE_AREA_LABEL } from '@ev-flow/core/lib/serviceArea'
import { COLORS } from '@ev-flow/core/lib/theme'
import { RouteBadge } from '../../components/RouteBadge'
import { SegmentedControl } from '../../components/SegmentedControl'
import { UpdateStatus } from '../../components/UpdateStatus'

/** 상태 표시줄 아래 제목까지 띄우는 여백 */
const TOP_GAP = 16

type ListView = 'route' | 'region'

const VIEW_OPTIONS: { value: ListView; label: string }[] = [
  { value: 'route', label: '노선별' },
  { value: 'region', label: '지역별' },
]

// 전국 고속도로 휴게소 (하단 탭 두 번째). 노선별 · 지역별로 묶고, 누르면 노선 · 지역 화면으로 넘어감
export default function ServiceAreaListScreen() {
  // 노선 화면에서 돌아와도 고른 묶음이 유지되도록 화면 값(?view=)에 둠
  const params = useLocalSearchParams<{ view?: string }>()
  const view: ListView = params.view === 'region' ? 'region' : 'route'
  const insets = useSafeAreaInsets()
  const { routes, totalCount, updatedAt, isError, loadState } = useServiceAreaRoutesData()

  // 묶음을 바꾸면 화면 기록을 쌓지 않고 이 화면의 값만 바꿈
  const changeView = (value: ListView) => router.setParams({ view: value })

  return (
    <ScrollView
      className="flex-1 bg-bg-subtle"
      contentContainerClassName="gap-3 px-4 pb-6"
      contentContainerStyle={{ paddingTop: insets.top + TOP_GAP }}
    >
      <View className="gap-0.5">
        <Text className="font-bold text-[22px] text-text-primary">고속도로 휴게소</Text>
        <Text className="font-sans text-[13px] text-text-secondary">
          전국{totalCount !== undefined && ` ${totalCount}곳`} · 현재 충전기 현황
        </Text>
      </View>
      <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={changeView} />
      <View className="flex-row items-center justify-between gap-2">
        <UpdateStatus updatedAt={updatedAt} isError={isError} />
        <Text className="flex-shrink-0 font-medium text-xs text-text-secondary">
          {NO_FORECAST_SERVICE_AREA_LABEL}
        </Text>
      </View>

      {/* 지역별은 다음 작업에서 채움. 지금은 탭 자리만 */}
      {view === 'region' ? (
        <Text className="py-12 text-center font-sans text-sm text-text-secondary">
          지역별 보기는 준비 중이에요
        </Text>
      ) : loadState === 'ready' ? (
        <View className="overflow-hidden rounded-lg bg-bg-page">
          {routes?.map((route, index) => (
            <RouteRow
              key={route.routeName}
              route={route}
              isFirst={index === 0}
              onPress={() =>
                router.push({
                  pathname: '/service-areas/route',
                  params: { name: route.routeName },
                })
              }
            />
          ))}
        </View>
      ) : loadState === 'loading' ? (
        <View className="h-[240px] rounded-lg bg-bg-page" />
      ) : (
        <Text className="py-12 text-center font-sans text-sm text-text-secondary">
          {loadState === 'error' ? '휴게소 정보를 불러오지 못했습니다' : '휴게소가 없습니다'}
        </Text>
      )}
    </ScrollView>
  )
}

type RouteRowProps = {
  route: RouteSummary
  isFirst: boolean
  onPress: () => void
}

/** 노선 목록 한 줄. 번호 배지 · 노선 이름 · 양 끝 도시 · 휴게소 수 */
function RouteRow({ route, isFirst, onPress }: RouteRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${route.label} 휴게소 ${route.areaCount}곳`}
      onPress={onPress}
      className={`min-h-[56px] flex-row items-center gap-3 px-4 py-3 active:bg-bg-subtle ${
        isFirst ? '' : 'border-t border-border-default'
      }`}
    >
      {/* 세 자리 번호 배지만큼 자리를 잡아 두어 노선 이름이 줄마다 같은 위치에서 시작하게 함 */}
      <View className="w-[36px] items-center">
        <RouteBadge routeNo={route.routeNo} />
      </View>
      <Text numberOfLines={1} className="min-w-0 flex-1">
        <Text className="font-bold text-base text-text-primary">{route.label}</Text>
        {/* 양 끝 도시는 방향 버튼이 있는 노선만 (순환선 등은 없음) */}
        {route.ends && (
          <Text className="font-sans text-[13px] text-text-secondary">
            {'  '}
            {route.ends[0]}–{route.ends[1]}
          </Text>
        )}
      </Text>
      <Text className="font-sans text-sm text-text-secondary">{route.areaCount}곳</Text>
      <ChevronRight size={18} strokeWidth={2} color={COLORS['text-secondary']} />
    </Pressable>
  )
}
