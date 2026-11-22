import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNow } from '@ev-flow/core/hooks/useNow'
import { useStationDetailData } from '@ev-flow/core/hooks/useStationDetailData'
import { findPrediction, HORIZONS, parseHorizon } from '@ev-flow/core/lib/horizon'
import type { HorizonMinutes } from '@ev-flow/core/types/station'
import { BackButton } from '../../../components/BackButton'
import { Button } from '../../../components/Button'
import { ChargerRow } from '../../../components/ChargerRow'
import { CongestionBadge } from '../../../components/CongestionBadge'
import { HorizonSummary } from '../../../components/HorizonSummary'
import { PredictionTile } from '../../../components/PredictionTile'
import { UpdateStatus } from '../../../components/UpdateStatus'

/** 아래 버튼 영역의 최소 여백. 홈 표시줄이 있으면 그 높이만큼 띄움 (웹 max(12px, safe-area)) */
const FOOTER_MIN_PADDING = 12

// 충전소 상세 화면. 데이터는 웹과 같은 core useStationDetailData, 예측 시점은 ?horizon= 값으로 받음
export default function StationDetailScreen() {
  const params = useLocalSearchParams<{ stationId: string; horizon?: string }>()
  const stationId = params.stationId ?? ''
  const horizon = parseHorizon(params.horizon ?? null)
  const now = useNow()
  const insets = useSafeAreaInsets()
  const { station, updatedAt, isError, isNotFound } = useStationDetailData(stationId, horizon)

  // 시점을 바꾸면 화면 기록을 쌓지 않고 이 화면의 값만 바꿈 (웹 replace와 같음)
  const selectHorizon = (value: HorizonMinutes) => router.setParams({ horizon: String(value) })

  // 길찾기 화면으로 (웹 /stations/{id}/route?horizon=)
  const openRoute = () =>
    router.push({
      pathname: '/stations/[stationId]/route',
      params: { stationId, horizon: String(horizon) },
    })

  // 시점별 설명 칸 높이. 가장 큰 값으로 칸을 고정해 시점을 바꿔도 충전기 현황이 움직이지 않게 함
  const [summaryHeights, setSummaryHeights] = useState<Partial<Record<HorizonMinutes, number>>>({})

  return (
    <View className="flex-1 bg-bg-page" style={{ paddingTop: insets.top }}>
      <View className="h-[52px] flex-row items-center gap-2 px-4">
        <BackButton />
        <Text className="font-bold text-[17px] text-text-primary">충전소 상세</Text>
      </View>

      {station ? (
        <>
          <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pt-2 pb-6">
            <View className="gap-1.5">
              <Text className="font-bold text-[22px] text-text-primary">{station.name}</Text>
              <Text className="font-sans text-sm text-text-secondary">
                {station.address} · 급속 {station.totalChargers}기
              </Text>
              <View className="flex-row flex-wrap items-center gap-2">
                <CongestionBadge congestion={station.congestion} />
                <UpdateStatus updatedAt={updatedAt} isError={isError} />
              </View>
            </View>

            <View className="gap-3">
              <Text className="font-bold text-base text-text-primary">시간대별 혼잡 예측</Text>
              <View accessibilityRole="radiogroup" className="flex-row gap-2">
                {HORIZONS.map((option) => {
                  const prediction = findPrediction(station, option)
                  // 서버가 이 시점 예측을 보내지 않았으면 칸을 그리지 않음
                  if (!prediction) return null
                  return (
                    <PredictionTile
                      key={option}
                      prediction={prediction}
                      isSelected={option === horizon}
                      onSelect={() => selectHorizon(option)}
                      // 지금 출발은 대기시간 대신 실시간 사용 가능 대수
                      caption={
                        option === 0
                          ? `${station.availableChargers}/${station.totalChargers}대`
                          : undefined
                      }
                    />
                  )
                })}
              </View>
            </View>

            {/* 세 시점 설명을 모두 그려 높이를 재고, 칸 높이를 가장 큰 높이로 고정함. 고른 것만 보이고 나머지는 같은 자리에 투명하게 겹침 */}
            <View style={{ minHeight: Math.max(0, ...Object.values(summaryHeights)) }}>
              {HORIZONS.map((option) => {
                const isSelected = option === horizon
                return (
                  <View
                    key={option}
                    // 고른 시점만 흐름 안에 두고, 나머지는 위에 겹쳐 높이만 잼
                    className={isSelected ? '' : 'absolute inset-x-0 top-0 opacity-0'}
                    pointerEvents={isSelected ? 'auto' : 'none'}
                    accessibilityElementsHidden={!isSelected}
                    importantForAccessibility={isSelected ? 'auto' : 'no-hide-descendants'}
                    onLayout={(e) => {
                      const height = e.nativeEvent.layout.height
                      setSummaryHeights((prev) =>
                        prev[option] === height ? prev : { ...prev, [option]: height },
                      )
                    }}
                  >
                    <HorizonSummary station={station} horizon={option} />
                  </View>
                )
              })}
            </View>

            <View className="gap-3">
              <Text className="font-bold text-base text-text-primary">충전기 현황</Text>
              <View className="overflow-hidden rounded-md border border-border-default">
                {station.chargers.map((charger, index) => (
                  <ChargerRow
                    key={charger.chargerId}
                    charger={charger}
                    now={now}
                    isLast={index === station.chargers.length - 1}
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          <View
            className="border-t border-border-default px-4 pt-3"
            style={{ paddingBottom: Math.max(FOOTER_MIN_PADDING, insets.bottom) }}
          >
            {/* 고른 시점을 그대로 넘겨 길찾기 화면에서도 같은 시점의 예상 대기를 보여 줌 */}
            <Button className="w-full" onPress={openRoute}>
              길찾기
            </Button>
          </View>
        </>
      ) : isNotFound || isError ? (
        <View className="flex-1 items-center justify-center">
          <Text className="font-sans text-sm text-text-secondary">
            {isNotFound ? '충전소를 찾을 수 없습니다' : '충전소 정보를 불러오지 못했습니다'}
          </Text>
        </View>
      ) : (
        // 처음 불러오는 동안 자리만 잡아 둠 (웹의 깜빡이는 회색 상자. 앱은 움직임 없이)
        <View className="gap-3 px-4 pt-2">
          <View className="h-7 w-2/3 rounded-sm bg-bg-subtle" />
          <View className="h-5 w-1/2 rounded-sm bg-bg-subtle" />
          <View className="mt-4 h-24 rounded-md bg-bg-subtle" />
        </View>
      )}
    </View>
  )
}
