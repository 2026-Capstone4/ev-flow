import { router } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMapView } from '@ev-flow/core/hooks/useMapView'
import { useChargerIssuesData } from '@ev-flow/core/hooks/useChargerIssuesData'
import { CHARGER_STATUS_LABEL, formatChargerSpec } from '@ev-flow/core/lib/charger'
import type { ChargerIssueFilter, StationChargerIssues } from '@ev-flow/core/lib/chargerIssues'
import { COLORS } from '@ev-flow/core/lib/theme'
import type { LatLng } from '@ev-flow/core/types/geo'
import { BackButton } from '../components/BackButton'
import { DistrictPicker } from '../components/DistrictPicker'
import { FilterChip } from '../components/FilterChip'
import { UpdateStatus } from '../components/UpdateStatus'
import { readDeviceLocation } from '../hooks/useCurrentLocation'
import { IS_GEOLOCATION_ENABLED } from '../lib/config'

type SectionProps = {
  title: string
  count: number
  description: ReactNode
  children: ReactNode
}

/** 목록 한 묶음 (제목 · 대수 · 설명 · 충전소 카드들) */
function Section({ title, count, description, children }: SectionProps) {
  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text className="font-bold text-base text-text-primary">
          {title} <Text className="text-text-secondary">{count}기</Text>
        </Text>
        <Text
          lineBreakStrategyIOS="hangul-word"
          className="font-sans text-[13px] text-text-secondary"
        >
          {description}
        </Text>
      </View>
      {children}
    </View>
  )
}

type StationIssueCardProps = {
  station: StationChargerIssues
  /** 충전기 행 오른쪽 상태 문구. 목록의 충전기는 모두 지금 확인 불가라 카드마다 하나 */
  statusLabel: string
  onPress: (stationId: string) => void
}

/** 충전소 한 곳의 상태 이상 충전기. 위쪽 충전소 이름을 누르면 충전소 상세로 감 */
function StationIssueCard({ station, statusLabel, onPress }: StationIssueCardProps) {
  return (
    <View className="overflow-hidden rounded-md border border-border-default">
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
          <Text
            lineBreakStrategyIOS="hangul-word"
            className="min-w-0 flex-shrink font-medium text-[13px] text-text-primary"
          >
            급속 {charger.chargerId} ·{' '}
            {formatChargerSpec(charger.connectorTypes, charger.capacityKw)}
          </Text>
          <Text className="flex-shrink-0 font-bold text-[13px] text-congestion-unknown">
            {statusLabel}
          </Text>
        </View>
      ))}
    </View>
  )
}

/** 목록이 비었을 때 칸 */
function EmptyRow({ message }: { message: string }) {
  return (
    <View className="items-center rounded-md bg-bg-subtle py-5">
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

// 상태 이상 충전기 목록. 지도 홈 검색창 아래 '상태 이상' 버튼으로 들어옴
// 미확인 = 지금 상태를 알 수 없는 충전기, 불안정 = 원천 데이터 문제로 상태가 계속 바뀌는 정해진 충전기 중 지금 확인 불가인 것
// 구는 처음에 현재 위치(GPS)에서 가장 가까운 충전소의 구, 못 잡으면 마포구. 화면을 나가면 고른 구 · 칩은 초기화됨
export default function ChargerIssuesScreen() {
  const insets = useSafeAreaInsets()
  const { horizon } = useMapView()

  // 사용자가 직접 고른 구. 고르기 전이면 null이라 위치로 잡은 구 또는 기본 구를 씀
  const [pickedDistrict, setPickedDistrict] = useState<string | null>(null)
  const [filter, setFilter] = useState<ChargerIssueFilter>('all')

  // 화면에 들어올 때 기기 위치를 한 번 잼. GPS 기능이 꺼져 있으면(시연 빌드) 재지 않고 기본 구를 씀
  const [deviceLocation, setDeviceLocation] = useState<LatLng | null>(null)
  useEffect(() => {
    // GPS를 쓰지 않는 빌드면 권한 창도 띄우지 않음
    if (!IS_GEOLOCATION_ENABLED) return
    let isActive = true
    readDeviceLocation().then((location) => {
      // 재는 동안 화면을 나갔으면 값을 버림
      if (isActive) setDeviceLocation(location)
    })
    return () => {
      isActive = false
    }
  }, [])

  // 고른 구 → 위치에서 가장 가까운 구 → 마포구 순으로 정해서 그 구의 목록을 받음
  const { district, isLocatedDistrict, issues, districts, updatedAt, isError, isAllUnknown } =
    useChargerIssuesData(pickedDistrict, deviceLocation)

  // 충전소 상세로. 지도 홈에서 보던 시점을 그대로 넘김
  const openStation = (stationId: string) =>
    router.push({
      pathname: '/stations/[stationId]',
      params: { stationId, horizon: String(horizon) },
    })

  /** 받은 데이터 상태에 따라 본문을 고름 */
  const renderBody = () => {
    // 아직 못 받았으면 실패 안내 또는 빈 자리
    if (!issues) {
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
          <Text
            lineBreakStrategyIOS="hangul-word"
            className="font-medium text-sm text-status-warning"
          >
            상태 수집이 늦어지고 있어요.
            {'\n'}지금은 모든 충전기 상태를 확인할 수 없어요.
          </Text>
        </View>
      )
    }

    const counts: Record<ChargerIssueFilter, number> = {
      all: issues.unknownCount + issues.unstableCount,
      unknown: issues.unknownCount,
      unstable: issues.unstableCount,
    }
    // 고른 칩이 0대가 되면(다른 구로 바꾼 경우 등) 전체로 보여 줌
    const activeFilter = counts[filter] > 0 ? filter : 'all'
    // 미확인 칸은 전체 · 상태 미확인일 때 보임
    const showUnknown = activeFilter !== 'unstable'
    // 불안정 칸은 상태 불안정을 골랐거나, 전체인데 1대 이상일 때만 보임 (마포구 밖은 늘 0이라 숨김)
    const showUnstable =
      activeFilter === 'unstable' || (activeFilter === 'all' && issues.unstableCount > 0)

    return (
      <>
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

        {showUnknown && (
          <Section
            title="상태 미확인 충전기"
            count={issues.unknownCount}
            description={
              <>
                통신이 끊겼거나 운영사가 상태를 보내지 않는 충전기예요.
                {'\n'}현장 상태와 다를 수 있어요.
              </>
            }
          >
            {issues.unknown.length > 0 ? (
              issues.unknown.map((station) => (
                <StationIssueCard
                  key={station.stationId}
                  station={station}
                  statusLabel={CHARGER_STATUS_LABEL.unknown}
                  onPress={openStation}
                />
              ))
            ) : (
              <EmptyRow message="지금은 상태를 모르는 충전기가 없어요" />
            )}
          </Section>
        )}

        {showUnstable && (
          <Section
            title="상태 불안정 충전기"
            count={issues.unstableCount}
            description="운영사 정보 오류로 상태가 계속 바뀌는 충전기예요."
          >
            {issues.unstable.map((station) => (
              <StationIssueCard
                key={station.stationId}
                station={station}
                statusLabel="상태 자주 바뀜"
                onPress={openStation}
              />
            ))}
          </Section>
        )}
      </>
    )
  }

  return (
    <View className="flex-1 bg-bg-page" style={{ paddingTop: insets.top }}>
      <View className="h-[52px] flex-row items-center gap-2 px-4">
        <BackButton />
        <Text className="font-bold text-[17px] text-text-primary">상태 이상 충전기</Text>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-4 pt-2"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* 갱신 시각 알약을 구 버튼 높이에 맞춤 */}
        <View className="flex-row flex-wrap items-stretch gap-2">
          <DistrictPicker
            value={district}
            districts={districts}
            isCurrentLocation={isLocatedDistrict}
            onChange={setPickedDistrict}
          />
          <UpdateStatus updatedAt={updatedAt} isError={isError} isStretched />
        </View>
        {renderBody()}
      </ScrollView>
    </View>
  )
}
