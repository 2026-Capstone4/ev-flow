import { router, useLocalSearchParams } from 'expo-router'
import { ChevronRight, Search, X } from 'lucide-react-native'
import { type ReactNode, useState } from 'react'
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native'
import { Text, TextInput } from '../../components/Text'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { UNMATCHED_REGION_CODE } from '@ev-flow/core/hooks/useServiceAreaRegionData'
import { useServiceAreaRoutesData } from '@ev-flow/core/hooks/useServiceAreaRoutesData'
import { getRouteLabel } from '@ev-flow/core/lib/nationwideServiceArea'
import { NO_FORECAST_SERVICE_AREA_LABEL } from '@ev-flow/core/lib/serviceArea'
import { COLORS } from '@ev-flow/core/lib/theme'
import type { NationwideServiceArea } from '@ev-flow/core/types/serviceArea'
import { RouteBadge } from '../../components/RouteBadge'
import { SegmentedControl } from '../../components/SegmentedControl'
import { ServiceAreaRow } from '../../components/ServiceAreaRow'
import { UpdateStatus } from '../../components/UpdateStatus'
import { pushWithoutKeyboard } from '../../lib/navigation'

/** 상태 표시줄 아래 제목까지 띄우는 여백 */
const TOP_GAP = 16

type ListView = 'route' | 'region'

const VIEW_OPTIONS: { value: ListView; label: string }[] = [
  { value: 'route', label: '노선별' },
  { value: 'region', label: '지역별' },
]

// 전국 고속도로 휴게소 (하단 탭 두 번째). 노선별 · 지역별로 묶고, 누르면 노선 · 지역 화면으로 넘어감
// 위 검색창에 입력하면 묶음 대신 검색 결과를 보여 주고, 결과를 누르면 바로 휴게소 상세로 감
// 줄을 누르면 키보드를 먼저 내리고 넘어감 (pushWithoutKeyboard)
export default function ServiceAreaListScreen() {
  // 노선 화면에서 돌아와도 고른 묶음이 유지되도록 화면 값(?view=)에 둠
  const params = useLocalSearchParams<{ view?: string }>()
  const view: ListView = params.view === 'region' ? 'region' : 'route'
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  // 검색어는 한글 조합이 끊기지 않게 화면 안 상태로 받음. 상세에 갔다 와도 탭 화면이 살아 있어 유지됨
  const [searchText, setSearchText] = useState('')
  const {
    routes,
    regions,
    searchResults,
    unmatchedCount,
    totalCount,
    updatedAt,
    isError,
    loadState,
  } = useServiceAreaRoutesData(searchText)
  const isSearching = searchText.trim() !== ''

  // 묶음을 바꾸면 화면 기록을 쌓지 않고 이 화면의 값만 바꿈
  const changeView = (value: ListView) => router.setParams({ view: value })

  return (
    <ScrollView
      // 키보드가 떠 있어도 결과를 한 번에 누를 수 있고, 목록을 끌면 키보드가 내려감
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      className="flex-1 bg-bg-subtle"
      contentContainerClassName="gap-3 px-4 pb-6"
      contentContainerStyle={{ paddingTop: insets.top + TOP_GAP }}
    >
      <View className="gap-0.5">
        <Text className="font-bold text-[22px] text-text-primary">고속도로 휴게소</Text>
        <Text className="font-sans text-[14px] text-text-secondary">
          전국{totalCount !== undefined && ` ${totalCount}곳`} · 현재 충전기 현황
        </Text>
      </View>
      <View className="flex-row items-center gap-2 rounded-md bg-bg-page px-3.5">
        <Search size={18} strokeWidth={2} color={COLORS['text-secondary']} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="휴게소 · 고속도로 · 지역"
          placeholderTextColor={COLORS['text-secondary']}
          accessibilityLabel="휴게소 검색"
          returnKeyType="search"
          autoCorrect={false}
          // 검색창이라 iOS 자동 완성(AutoFill) 말풍선이 뜨지 않게 함
          autoComplete="off"
          className="min-w-0 flex-1 py-3.5 font-medium text-[17px] text-text-primary"
        />
        {/* 검색어가 있을 때만 지우기 버튼 */}
        {searchText !== '' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="검색어 지우기"
            onPress={() => setSearchText('')}
            hitSlop={8}
          >
            <X size={16} strokeWidth={2} color={COLORS['text-secondary']} />
          </Pressable>
        )}
      </View>
      {/* 검색 중에는 묶음 탭이 결과와 상관없어서 숨김 */}
      {!isSearching && (
        <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={changeView} />
      )}
      {/* 갱신 알약 높이(28)를 미리 잡아 둬서, 목록이 들어와 알약이 생겨도 아래 패널이 밀려 내려가지 않음 */}
      <View className="min-h-[28px] flex-row items-center justify-between gap-2">
        <UpdateStatus updatedAt={updatedAt} isError={isError} />
        <Text className="flex-shrink-0 font-medium text-xs text-text-secondary">
          {NO_FORECAST_SERVICE_AREA_LABEL}
        </Text>
      </View>

      {/* 검색 중이면 검색 결과, 아니면 고른 묶음(노선별 · 지역별) */}
      {isSearching && searchResults ? (
        <SearchResults
          results={searchResults}
          onPress={(id) =>
            pushWithoutKeyboard({ pathname: '/service-areas/detail', params: { id } })
          }
        />
      ) : loadState === 'ready' && view === 'region' ? (
        <View className="overflow-hidden rounded-lg bg-bg-page">
          {regions?.map((region, index) => (
            <GroupRow
              key={region.code}
              title={region.label}
              count={region.areaCount}
              isFirst={index === 0}
              onPress={() =>
                pushWithoutKeyboard({
                  pathname: '/service-areas/region',
                  params: { code: region.code },
                })
              }
            />
          ))}
        </View>
      ) : loadState === 'ready' ? (
        <View className="overflow-hidden rounded-lg bg-bg-page">
          {routes?.map((route, index) => (
            <GroupRow
              key={route.routeName}
              // 세 자리 번호 배지만큼 자리를 잡아 두어 노선 이름이 줄마다 같은 위치에서 시작하게 함
              badge={
                <View className="w-[36px] items-center">
                  <RouteBadge routeNo={route.routeNo} />
                </View>
              }
              title={route.label}
              // 양 끝 도시는 방향 버튼이 있는 노선만 (순환선 등은 없음)
              subtitle={route.ends && `${route.ends[0]}–${route.ends[1]}`}
              count={route.areaCount}
              isFirst={index === 0}
              onPress={() =>
                pushWithoutKeyboard({
                  pathname: '/service-areas/route',
                  params: { name: route.routeName },
                })
              }
            />
          ))}
          {/* 노선을 못 붙인 휴게소(민자 노선 등)는 맨 아래 한 줄로 모아 시도별 화면으로 */}
          {!!unmatchedCount && (
            <GroupRow
              title="노선 미확인"
              subtitle="민자 고속도로 등"
              count={unmatchedCount}
              isFirst={false}
              onPress={() =>
                pushWithoutKeyboard({
                  pathname: '/service-areas/region',
                  params: { code: UNMATCHED_REGION_CODE },
                })
              }
            />
          )}
        </View>
      ) : loadState === 'loading' ? (
        // 받아 올 목록(노선 30여 줄 · 지역 17줄)은 늘 화면보다 길어서, 빈 패널도 화면 높이만큼 잡아 화면 아래까지 채움
        <View style={{ height: windowHeight }} className="rounded-lg bg-bg-page" />
      ) : (
        <Text className="py-12 text-center font-sans text-sm text-text-secondary">
          {loadState === 'error' ? '휴게소 정보를 불러오지 못했습니다' : '휴게소가 없습니다'}
        </Text>
      )}
    </ScrollView>
  )
}

type GroupRowProps = {
  /** 왼쪽 배지 (노선 번호). 지역 줄은 없음 */
  badge?: ReactNode
  title: string
  /** 이름 옆 작은 글자 (노선 양 끝 도시 등) */
  subtitle?: string | null
  /** 오른쪽 휴게소 수 */
  count: number
  isFirst: boolean
  onPress: () => void
}

/** 노선별 · 지역별 목록 한 줄. 배지 · 이름 · 작은 설명 · 휴게소 수 · 화살표 */
function GroupRow({ badge, title, subtitle, count, isFirst, onPress }: GroupRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} 휴게소 ${count}곳`}
      onPress={onPress}
      className={`min-h-[56px] flex-row items-center gap-3 px-4 py-3 active:bg-bg-subtle ${
        isFirst ? '' : 'border-t border-border-default'
      }`}
    >
      {badge}
      <Text numberOfLines={1} className="min-w-0 flex-1">
        <Text className="font-bold text-base text-text-primary">{title}</Text>
        {/* 작은 설명이 있을 때만 이름 옆에 */}
        {subtitle && (
          <Text className="font-sans text-[14px] text-text-secondary">
            {'  '}
            {subtitle}
          </Text>
        )}
      </Text>
      <Text className="font-sans text-sm text-text-secondary">{count}곳</Text>
      <ChevronRight size={18} strokeWidth={2} color={COLORS['text-secondary']} />
    </Pressable>
  )
}

type SearchResultsProps = {
  results: NationwideServiceArea[]
  onPress: (id: string) => void
}

/** 검색 결과 목록. 이름은 방향이 들어간 이름, 옆에 노선(없으면 노선 미확인)을 작게 */
function SearchResults({ results, onPress }: SearchResultsProps) {
  // 찾은 휴게소가 없으면 안내 문구만
  if (results.length === 0) {
    return (
      <Text className="py-12 text-center font-sans text-sm text-text-secondary">
        찾는 휴게소가 없어요
      </Text>
    )
  }
  return (
    <View className="gap-2">
      <Text className="px-1 font-medium text-[14px] text-text-secondary">
        검색 결과 {results.length}곳
      </Text>
      <View className="overflow-hidden rounded-lg bg-bg-page">
        {results.map((area, index) => (
          <ServiceAreaRow
            key={area.id}
            serviceArea={area}
            title={area.name}
            note={area.routeName ? getRouteLabel(area.routeName) : '노선 미확인'}
            isFirst={index === 0}
            onPress={() => onPress(area.id)}
          />
        ))}
      </View>
    </View>
  )
}
