import { router } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import { memo, useCallback, useMemo, useState, type ReactNode } from 'react'
import { FlatList, Pressable, Text, View, type ListRenderItem } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMapView } from '@ev-flow/core/hooks/useMapView'
import { useChargerIssuesData } from '@ev-flow/core/hooks/useChargerIssuesData'
import { CHARGER_STATUS_LABEL, formatChargerSpec } from '@ev-flow/core/lib/charger'
import {
  ALL_DISTRICTS,
  type ChargerIssueFilter,
  type ChargerIssueKind,
  type StationChargerIssues,
} from '@ev-flow/core/lib/chargerIssues'
import { COLORS } from '@ev-flow/core/lib/theme'
import { BackButton } from '../components/BackButton'
import { DistrictPicker } from '../components/DistrictPicker'
import { FilterChip } from '../components/FilterChip'
import { UpdateStatus } from '../components/UpdateStatus'
import { KoreanText } from '../components/KoreanText'

type SectionHeaderProps = {
  title: string
  count: number
  description: ReactNode
}

/** 목록 한 묶음의 머리 (제목 · 대수 · 설명). 바로 위 칸과 gap-5만큼 띄움 */
function SectionHeader({ title, count, description }: SectionHeaderProps) {
  return (
    <View className="mt-5 gap-1">
      <Text className="font-bold text-base text-text-primary">
        {title} <Text className="text-text-secondary">{count}기</Text>
      </Text>
      <KoreanText className="font-sans text-[14px] text-text-secondary">{description}</KoreanText>
    </View>
  )
}

/** 칸마다 머리 문구와 충전기 행 오른쪽 상태 문구 */
const SECTION_TEXT: Record<
  ChargerIssueKind,
  { title: string; description: ReactNode; statusLabel: string }
> = {
  unknown: {
    title: '상태 미확인 충전기',
    description: (
      <>
        통신이 끊겼거나 운영사가 상태를 보내지 않는 충전기예요.
        {'\n'}현장 상태와 다를 수 있어요.
      </>
    ),
    statusLabel: CHARGER_STATUS_LABEL.unknown,
  },
  unstable: {
    title: '상태 불안정 충전기',
    description: '운영사 정보 오류로 상태가 계속 바뀌는 충전기예요.',
    statusLabel: '상태 자주 바뀜',
  },
}

type StationIssueCardProps = {
  station: StationChargerIssues
  /** 충전기 행 오른쪽 상태 문구. 목록의 충전기는 모두 지금 확인 불가라 카드마다 하나 */
  statusLabel: string
  onPress: (stationId: string) => void
}

/**
 * 충전소 한 곳의 상태 이상 충전기. 위쪽 충전소 이름을 누르면 충전소 상세로 감
 * 칩을 바꾸거나 갱신 시각이 바뀌어 화면이 다시 그려져도 같은 충전소 카드는 다시 그리지 않게 memo로 감쌈
 */
const StationIssueCard = memo(function StationIssueCard({
  station,
  statusLabel,
  onPress,
}: StationIssueCardProps) {
  return (
    <View className="mt-3 overflow-hidden rounded-md border border-border-default">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${station.name} 상세 보기`}
        onPress={() => onPress(station.stationId)}
        className="flex-row items-center gap-2 border-b border-border-default bg-bg-subtle px-4 py-2.5 active:opacity-70"
      >
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-bold text-sm text-text-primary">
            {station.name}
          </Text>
          <Text numberOfLines={1} className="font-sans text-xs text-text-secondary">
            {station.address}
          </Text>
        </View>
        <ChevronRight size={18} color={COLORS['text-secondary']} />
      </Pressable>
      {station.chargers.map((charger, index) => (
        <View
          key={charger.chargerId}
          className={`flex-row items-center justify-between gap-2 px-4 py-2.5 ${
            index === station.chargers.length - 1 ? '' : 'border-b border-border-default'
          }`}
        >
          <KoreanText className="min-w-0 flex-shrink font-medium text-[14px] text-text-primary">
            급속 {charger.chargerId} ·{' '}
            {formatChargerSpec(charger.connectorTypes, charger.capacityKw)}
          </KoreanText>
          <Text className="flex-shrink-0 font-bold text-[14px] text-congestion-unknown">
            {statusLabel}
          </Text>
        </View>
      ))}
    </View>
  )
})

/** 목록이 비었을 때 칸 */
function EmptyRow({ message }: { message: string }) {
  return (
    <View className="mt-3 items-center rounded-md bg-bg-subtle py-5">
      <Text className="font-sans text-sm text-text-secondary">{message}</Text>
    </View>
  )
}

/** 칩 순서와 이름 */
const FILTER_OPTIONS: { value: ChargerIssueFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'unknown', label: '상태 미확인' },
  { value: 'unstable', label: '상태 불안정' },
]

/** 목록 한 줄. 칸 머리 · 충전소 카드 · 빈 칸 안내를 한 FlatList에 차례로 넣음 */
type ListRow =
  | { type: 'header'; key: string; kind: ChargerIssueKind; count: number }
  | { type: 'station'; key: string; kind: ChargerIssueKind; station: StationChargerIssues }
  | { type: 'empty'; key: string; message: string }

/** 줄마다 FlatList가 쓰는 키 */
const keyOfRow = (row: ListRow) => row.key

// 상태 이상 충전기 목록. 지도 홈 검색창 아래 '상태 이상' 버튼으로 들어옴
// 미확인 = 지금 상태를 알 수 없는 충전기, 불안정 = 원천 데이터 문제로 상태가 계속 바뀌는 정해진 충전기 중 지금 확인 불가인 것
// 처음에는 서울 전체를 보여 주고, 구를 고르면 그 구만. 화면을 나가면 고른 구 · 칩은 초기화됨
// 서울 전체는 충전소 200곳 남짓이라 FlatList로 화면에 보이는 만큼만 먼저 그림
export default function ChargerIssuesScreen() {
  const insets = useSafeAreaInsets()
  const { horizon } = useMapView()

  // 보여 줄 구. 처음에는 서울 전체('전체')로 시작함
  const [district, setDistrict] = useState<string>(ALL_DISTRICTS)
  const [filter, setFilter] = useState<ChargerIssueFilter>('all')

  // 고른 구의 목록을 받음
  const { issues, districts, updatedAt, isError, isAllUnknown } = useChargerIssuesData(district)

  // 충전소 상세로. 지도 홈에서 보던 시점을 그대로 넘김 (카드 memo가 풀리지 않게 시점이 바뀔 때만 새로 만듦)
  const openStation = useCallback(
    (stationId: string) =>
      router.push({
        pathname: '/stations/[stationId]',
        params: { stationId, horizon: String(horizon) },
      }),
    [horizon],
  )

  // 칩마다 대수
  const counts = useMemo<Record<ChargerIssueFilter, number> | null>(
    () =>
      issues
        ? {
            all: issues.unknownCount + issues.unstableCount,
            unknown: issues.unknownCount,
            unstable: issues.unstableCount,
          }
        : null,
    [issues],
  )
  // 고른 칩이 0대가 되면(다른 구로 바꾼 경우 등) 전체로 보여 줌
  const activeFilter = counts && counts[filter] > 0 ? filter : 'all'

  // 목록 줄. 아직 못 받았거나 수집이 끊겨 안내만 띄울 때는 비움
  const rows = useMemo<ListRow[]>(() => {
    // 목록을 그리지 않는 상태면 줄이 없음
    if (!issues || isAllUnknown) return []
    const list: ListRow[] = []
    // 미확인 칸은 전체 · 상태 미확인일 때 보임
    if (activeFilter !== 'unstable') {
      list.push({
        type: 'header',
        key: 'header-unknown',
        kind: 'unknown',
        count: issues.unknownCount,
      })
      for (const station of issues.unknown) {
        list.push({
          type: 'station',
          key: `unknown-${station.stationId}`,
          kind: 'unknown',
          station,
        })
      }
      // 미확인 충전소가 없으면 빈 칸 안내
      if (issues.unknown.length === 0) {
        list.push({
          type: 'empty',
          key: 'empty-unknown',
          message: '지금은 상태를 모르는 충전기가 없어요',
        })
      }
    }
    // 불안정 칸은 상태 불안정을 골랐거나, 전체인데 1대 이상일 때만 보임 (마포구 밖은 늘 0이라 숨김)
    if (activeFilter === 'unstable' || (activeFilter === 'all' && issues.unstableCount > 0)) {
      list.push({
        type: 'header',
        key: 'header-unstable',
        kind: 'unstable',
        count: issues.unstableCount,
      })
      for (const station of issues.unstable) {
        list.push({
          type: 'station',
          key: `unstable-${station.stationId}`,
          kind: 'unstable',
          station,
        })
      }
    }
    return list
  }, [issues, isAllUnknown, activeFilter])

  /** 줄 종류에 맞는 칸을 그림 */
  const renderRow = useCallback<ListRenderItem<ListRow>>(
    ({ item }) => {
      // 칸 머리
      if (item.type === 'header') {
        const text = SECTION_TEXT[item.kind]
        return (
          <SectionHeader title={text.title} count={item.count} description={text.description} />
        )
      }
      // 빈 칸 안내
      if (item.type === 'empty') return <EmptyRow message={item.message} />
      return (
        <StationIssueCard
          station={item.station}
          statusLabel={SECTION_TEXT[item.kind].statusLabel}
          onPress={openStation}
        />
      )
    },
    [openStation],
  )

  /** 목록 위 칸. 받은 데이터 상태에 따라 칩 또는 불러오기 · 실패 · 수집 지연 안내를 고름 */
  const renderStatus = () => {
    // 아직 못 받았으면 실패 안내 또는 빈 자리
    if (!issues || !counts) {
      // 처음 불러오기가 실패했으면 안내, 아니면 불러오는 동안 회색 상자
      if (isError) {
        return (
          <View className="items-center pt-16">
            <Text className="font-sans text-sm text-text-secondary">
              충전기 정보를 불러오지 못했습니다
            </Text>
          </View>
        )
      }
      return (
        <View className="gap-3">
          <View className="h-5 w-1/2 rounded-sm bg-bg-subtle" />
          <View className="h-24 rounded-md bg-bg-subtle" />
          <View className="h-24 rounded-md bg-bg-subtle" />
        </View>
      )
    }
    // 수집이 오래 끊기면 모든 충전기가 확인 불가라 목록 대신 안내만
    if (isAllUnknown) {
      return (
        <View className="rounded-md bg-status-warning-bg px-4 py-3">
          <KoreanText className="font-medium text-sm text-status-warning">
            상태 수집이 늦어지고 있어요.
            {'\n'}지금은 모든 충전기 상태를 확인할 수 없어요.
          </KoreanText>
        </View>
      )
    }
    return (
      <View className="flex-row flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <FilterChip
            key={option.value}
            label={`${option.label} ${counts[option.value]}`}
            isSelected={option.value === activeFilter}
            // 0대인 칩은 골라도 볼 게 없어서 흐리게 두고 누를 수 없게 함 ('전체'는 늘 누를 수 있음)
            disabled={option.value !== 'all' && counts[option.value] === 0}
            onPress={() => setFilter(option.value)}
          />
        ))}
      </View>
    )
  }

  return (
    <View className="flex-1 bg-bg-page" style={{ paddingTop: insets.top }}>
      <View className="h-[52px] flex-row items-center gap-2 px-4">
        <BackButton />
        <Text className="font-bold text-[18px] text-text-primary">상태 이상 충전기</Text>
      </View>
      <FlatList
        className="flex-1"
        data={rows}
        keyExtractor={keyOfRow}
        renderItem={renderRow}
        ListHeaderComponent={
          <View className="gap-5">
            {/* 갱신 시각 알약을 구 버튼 높이에 맞춤 */}
            <View className="flex-row flex-wrap items-stretch gap-2">
              <DistrictPicker value={district} districts={districts} onChange={setDistrict} />
              <UpdateStatus updatedAt={updatedAt} isError={isError} isStretched />
            </View>
            {renderStatus()}
          </View>
        }
        // 처음에는 화면 한 장 남짓만 그리고, 나머지는 스크롤에 맞춰 그림
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        contentContainerClassName="px-4 pt-2"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      />
    </View>
  )
}
