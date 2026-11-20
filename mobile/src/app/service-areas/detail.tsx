import { useLocalSearchParams } from 'expo-router'
import { Info } from 'lucide-react-native'
import { ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNow } from '@ev-flow/core/hooks/useNow'
import { useServiceAreaDetailData } from '@ev-flow/core/hooks/useServiceAreaDetailData'
import {
  AVAILABILITY_TONE_CLASS,
  getAvailabilityTone,
  parseDirection,
} from '@ev-flow/core/lib/serviceArea'
import { COLORS } from '@ev-flow/core/lib/theme'
import { BackButton } from '../../components/BackButton'
import { Button } from '../../components/Button'
import { ChargerRow } from '../../components/ChargerRow'
import { DirectionTag } from '../../components/DirectionTag'
import { UpdateStatus } from '../../components/UpdateStatus'
import { openNaverMapCarRoute } from '../../lib/openNaverMapApp'

/** 아래 버튼 영역의 최소 여백. 홈 표시줄이 있으면 그 높이만큼 띄움 (웹 max(12px, safe-area)) */
const FOOTER_MIN_PADDING = 12

// 휴게소 상세. 웹과 같은 주소(/service-areas/detail?name=&direction=)와 core useServiceAreaDetailData를 씀
// 휴게소는 앱 안 경로 미리보기가 없어서(POST /routes는 도심 충전소만) 길찾기 버튼이 바로 네이버 지도 앱을 엶
export default function ServiceAreaDetailScreen() {
  const params = useLocalSearchParams<{ name?: string; direction?: string }>()
  const name = params.name ?? ''
  const direction = parseDirection(params.direction ?? null)
  const now = useNow()
  const insets = useSafeAreaInsets()
  const { serviceArea, chargerGroups, unknownCount, updatedAt, isError, isNotFound } =
    useServiceAreaDetailData(name, direction)

  return (
    <View className="flex-1 bg-bg-page" style={{ paddingTop: insets.top }}>
      <View className="h-[52px] flex-row items-center gap-2 px-4">
        <BackButton />
        <Text className="font-bold text-[17px] text-text-primary">휴게소 상세</Text>
      </View>

      {serviceArea && chargerGroups ? (
        <>
          <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pt-2 pb-8">
            <View className="items-start gap-1.5">
              <View className="flex-row items-center gap-2">
                <Text className="flex-shrink font-bold text-[22px] text-text-primary">
                  {serviceArea.name}
                </Text>
                <DirectionTag direction={serviceArea.direction} />
              </View>
              <Text className="font-sans text-sm text-text-secondary">
                {serviceArea.route}선 · 급속 {serviceArea.totalChargers}기
              </Text>
              <UpdateStatus updatedAt={updatedAt} isError={isError} />
            </View>

            <View className="flex-row gap-2 rounded-sm bg-bg-subtle px-3 py-2.5">
              <View className="pt-px">
                <Info size={16} strokeWidth={2} color={COLORS['text-secondary']} />
              </View>
              <Text
                lineBreakStrategyIOS="hangul-word"
                className="flex-1 font-sans text-[13px] text-text-secondary"
              >
                휴게소는 현재 충전기 현황만 보여줘요. 혼잡 예측과 예상 대기는 도심 충전소에서만
                제공해요.
              </Text>
            </View>

            <View className="gap-1.5">
              <Text className="font-bold text-base text-text-primary">지금 사용 가능</Text>
              {/* 큰 숫자와 작은 글자의 바닥선을 맞추려고 한 Text 안에 넣음 */}
              <Text>
                <Text
                  className={`font-bold text-[32px] ${
                    AVAILABILITY_TONE_CLASS[
                      getAvailabilityTone(
                        serviceArea.availableChargers,
                        serviceArea.totalChargers,
                        unknownCount,
                      )
                    ]
                  }`}
                >
                  {serviceArea.availableChargers}대
                </Text>
                <Text className="font-sans text-base text-text-secondary">
                  {' '}
                  / 급속 {serviceArea.totalChargers}기
                </Text>
              </Text>
            </View>

            <View className="gap-3">
              <Text className="font-bold text-base text-text-primary">충전기 현황</Text>
              {chargerGroups.map(({ operator, stations }) => (
                <View key={operator} className="gap-2">
                  {/* 운영기관이 하나면 묶음 제목은 생략 */}
                  {chargerGroups.length > 1 && (
                    <Text className="font-medium text-[13px] text-text-secondary">{operator}</Text>
                  )}
                  {/* 충전기 번호가 충전소마다 01부터라 충전소별로 상자를 나눠 번호 중복을 구분 */}
                  {stations.map(({ stationId, chargers }) => (
                    <View
                      key={stationId}
                      className="overflow-hidden rounded-md border border-border-default"
                    >
                      {chargers.map((charger, index) => (
                        <ChargerRow
                          key={charger.chargerId}
                          charger={charger}
                          now={now}
                          isLast={index === chargers.length - 1}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>

          <View
            className="border-t border-border-default px-4 pt-3"
            style={{ paddingBottom: Math.max(FOOTER_MIN_PADDING, insets.bottom) }}
          >
            <Button
              className="w-full"
              onPress={() =>
                openNaverMapCarRoute({
                  lat: serviceArea.lat,
                  lng: serviceArea.lng,
                  name: serviceArea.name,
                })
              }
            >
              네이버 지도로 길찾기
            </Button>
          </View>
        </>
      ) : isNotFound || isError ? (
        <View className="flex-1 items-center justify-center">
          <Text className="font-sans text-sm text-text-secondary">
            {isNotFound ? '휴게소를 찾을 수 없습니다' : '휴게소 정보를 불러오지 못했습니다'}
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
