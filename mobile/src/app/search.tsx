import { router, useLocalSearchParams } from 'expo-router'
import { X } from 'lucide-react-native'
import { useState } from 'react'
import { FlatList, Pressable, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMapView } from '@ev-flow/core/hooks/useMapView'
import { useSearchData } from '@ev-flow/core/hooks/useSearchData'
import { DEFAULT_FILTERS, isDefaultFilters } from '@ev-flow/core/lib/stationFilter'
import type { StationSortKey } from '@ev-flow/core/lib/stationSearch'
import { COLORS } from '@ev-flow/core/lib/theme'
import { BackButton } from '../components/BackButton'
import { Button } from '../components/Button'
import { FilterChip } from '../components/FilterChip'
import { HorizonSelector } from '../components/HorizonSelector'
import { SearchResultRow } from '../components/SearchResultRow'
import { FilterRow, StationFilterOptions } from '../components/StationFilterOptions'

const SORT_OPTIONS: { label: string; value: StationSortKey }[] = [
  { label: '추천순', value: 'recommended' },
  { label: '거리순', value: 'distance' },
  { label: '대기 짧은순', value: 'wait' },
]

// 검색어가 없을 때 한 번에 보여 주는 충전소 수
const PAGE_SIZE = 30

function parseSortKey(value: string | undefined): StationSortKey {
  return SORT_OPTIONS.find((option) => option.value === value)?.value ?? 'recommended'
}

// 충전소 검색 · 필터. 웹과 같은 주소(/search?q=&sort=)와 core useSearchData를 씀
// 시점 · 필터는 지도 홈과 함께 쓰는 MapView 상태라 여기서 바꾸면 지도 홈에도 그대로 남음
export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string; sort?: string }>()
  const insets = useSafeAreaInsets()
  const { horizon, setHorizon, filters, setFilters, userLocation } = useMapView()
  // 검색어는 한글 조합이 끊기지 않게 화면 안 상태로 받음. 상세에 갔다 와도 화면이 살아 있어 유지됨
  const [query, setQuery] = useState(params.q ?? '')
  const sortKey = parseSortKey(params.sort)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // 검색 화면이 열린 채로 딥링크(evflow://search?q=)가 오면 화면을 새로 만들지 않고 값만 바뀜
  // 그래서 바깥에서 q가 바뀌면 입력칸도 그 값으로 맞춤 (입력할 때는 q를 안 바꾸므로 타이핑과 안 부딪힘)
  const [lastParamQuery, setLastParamQuery] = useState(params.q)
  if (params.q !== lastParamQuery) {
    setLastParamQuery(params.q)
    setQuery(params.q ?? '')
    setVisibleCount(PAGE_SIZE)
  }

  const changeQuery = (value: string) => {
    setQuery(value)
    // 검색어를 바꾸면 다시 처음 30곳부터 보여 줌
    setVisibleCount(PAGE_SIZE)
  }

  const { results, isError } = useSearchData({
    origin: userLocation,
    query,
    filters,
    horizon,
    sortKey,
  })
  // 검색어가 있으면 찾은 결과를 모두, 없으면 정렬 순서대로 visibleCount곳까지만 보여 줌
  const visibleResults = query ? results : results?.slice(0, visibleCount)
  const hasMore = !!results && !!visibleResults && visibleResults.length < results.length

  return (
    <View className="flex-1 bg-bg-page" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-2 px-4 py-2">
        <BackButton />
        <View className="min-w-0 flex-1 flex-row items-center gap-2 rounded-md bg-bg-subtle px-3.5">
          <TextInput
            // 검색창을 눌러 들어온 화면이라 바로 입력할 수 있게 함
            autoFocus
            value={query}
            onChangeText={changeQuery}
            placeholder="충전소 이름·주소 검색"
            placeholderTextColor={COLORS['text-secondary']}
            accessibilityLabel="충전소 검색"
            returnKeyType="search"
            autoCorrect={false}
            // 검색창이라 iOS 자동 완성(AutoFill) 말풍선이 뜨지 않게 함
            autoComplete="off"
            className="min-w-0 flex-1 py-2.5 font-medium text-base text-text-primary"
          />
          {query !== '' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="검색어 지우기"
              onPress={() => changeQuery('')}
              hitSlop={8}
            >
              <X size={16} strokeWidth={2} color={COLORS['text-secondary']} />
            </Pressable>
          )}
        </View>
      </View>

      {/* 시점은 모든 결과의 예측 기준을 바꾸는 필수 선택이라, 결과를 줄이는 필터 칩과 따로 세그먼트로 둠 */}
      <View className="border-b border-border-default px-4 pt-2 pb-3">
        <HorizonSelector value={horizon} onChange={setHorizon} variant="inline" />
      </View>

      <View className="items-start gap-3 border-b border-border-default px-4 pt-3 pb-4">
        <StationFilterOptions filters={filters} onChange={setFilters} />
        <FilterRow label="정렬">
          {SORT_OPTIONS.map(({ label, value }) => (
            <FilterChip
              key={value}
              label={label}
              isSelected={sortKey === value}
              // 정렬은 화면 값(?sort=)에 둬서 화면 기록을 쌓지 않고 바꿈
              onPress={() => router.setParams({ sort: value })}
            />
          ))}
        </FilterRow>
      </View>

      {results && visibleResults ? (
        <FlatList
          className="flex-1"
          data={visibleResults}
          keyExtractor={(result) => result.station.stationId}
          // 키보드가 떠 있어도 결과를 한 번에 누를 수 있고, 목록을 끌면 키보드가 내려감
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: insets.bottom }}
          ListHeaderComponent={
            <Text className="px-4 pt-4 pb-1 font-medium text-[13px] text-text-secondary">
              검색 결과 {results.length}곳 ·{' '}
              {horizon === 0 ? '지금 기준' : `${horizon}분 후 예측 기준`}
            </Text>
          }
          renderItem={({ item }) => (
            <SearchResultRow
              result={item}
              onPress={() =>
                router.push({
                  pathname: '/stations/[stationId]',
                  params: { stationId: item.station.stationId, horizon: String(horizon) },
                })
              }
            />
          )}
          ListFooterComponent={
            hasMore ? (
              <View className="p-4">
                <Button
                  variant="secondary"
                  className="w-full"
                  onPress={() => setVisibleCount((count) => count + PAGE_SIZE)}
                >
                  {`더보기 (${visibleResults.length}/${results.length})`}
                </Button>
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <View className="items-center gap-2 px-4 pt-12 pb-6">
              <Text className="font-bold text-base text-text-primary">
                조건에 맞는 충전소가 없어요
              </Text>
              <Text className="text-center font-sans text-[13px] text-text-secondary">
                필터를 줄이거나 다른 지역 이름으로 검색해 보세요.
              </Text>
              {/* 필터를 바꿔 둔 경우에만 한 번에 되돌리는 버튼을 보여 줌 */}
              {!isDefaultFilters(filters) && (
                <Button
                  variant="secondary"
                  className="mt-2"
                  onPress={() => setFilters(DEFAULT_FILTERS)}
                >
                  필터 초기화
                </Button>
              )}
            </View>
          }
        />
      ) : (
        <Text className="px-4 pt-12 text-center font-sans text-sm text-text-secondary">
          {isError ? '충전소 정보를 불러오지 못했습니다' : '불러오는 중…'}
        </Text>
      )}
    </View>
  )
}
