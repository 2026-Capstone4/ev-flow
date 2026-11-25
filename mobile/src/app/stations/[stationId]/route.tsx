import { NaverMapView, type NaverMapViewRef } from '@mj-studio/react-native-naver-map'
import { router, useLocalSearchParams } from 'expo-router'
import { TriangleAlert, X } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMapView } from '@ev-flow/core/hooks/useMapView'
import { useRouteData } from '@ev-flow/core/hooks/useRouteData'
import { formatWaitRange, NO_PREDICTION_LABEL } from '@ev-flow/core/lib/congestion'
import { getHorizonWhen, parseHorizon } from '@ev-flow/core/lib/horizon'
import { getRetryWaitText } from '@ev-flow/core/lib/rateLimit'
import { formatDistance } from '@ev-flow/core/lib/stationSearch'
import { COLORS } from '@ev-flow/core/lib/theme'
import type { LatLng } from '@ev-flow/core/types/geo'
import { BackButton, FLOATING_BUTTON_SHADOW } from '../../../components/BackButton'
import { Button } from '../../../components/Button'
import { openMapCarRoute } from '../../../lib/openMapApp'
import { RouteOverlay, toRegion } from '../../../map/RouteOverlay'
import { StationMarker } from '../../../map/StationMarker'
import { toAppZoom } from '../../../map/zoom'
import { createShadow } from '../../../lib/shadow'
import { KoreanText } from '../../../components/KoreanText'
import { getFooterPaddingBottom } from '../../../lib/footerPadding'

/** 경로를 받기 전 첫 화면 줌 (웹 기준 14) */
const INITIAL_WEB_ZOOM = 14

/** 상태 표시줄 아래 뒤로 · 닫기 버튼까지 띄우는 여백 (웹 top-4) */
const TOP_GAP = 16
/** 뒤로 · 닫기 버튼 크기 */
const TOP_BUTTON_SIZE = 40
/** 경로를 화면에 맞출 때 위 버튼 · 아래 시트 · 좌우 가장자리와 띄우는 간격 (웹 fitBounds 여백 40) */
const FIT_MARGIN = 40

/** 아래 시트의 최소 여백 (웹 max(16px, safe-area)). 플랫폼별 계산은 lib/footerPadding.ts getFooterPaddingBottom */
const SHEET_MIN_PADDING = 16

/** 웹 시트 그림자(0 -2px 12px 12%)를 RN 그림자 속성으로 옮김 */
const SHEET_SHADOW = createShadow(-2, 12, 0.12)

/** 경로를 만든 길찾기 제공자 이름. 약관상 출처를 헷갈리지 않게 시트에 작게 표시함 */
const ROUTE_PROVIDER_LABEL = { kakao: '카카오모빌리티', naver: '네이버' } as const

/** 마커는 길찾기 화면에서 누를 일이 없어 아무것도 하지 않음 */
const noop = () => {}

// 길찾기 화면 (웹 /stations/{id}/route?horizon=). 데이터는 웹과 같은 core useRouteData
// 앱 안에서는 경로 미리보기만 하고, 실제 운전 안내는 네이버 지도 · 카카오맵 앱에 넘김
export default function RouteScreen() {
  const params = useLocalSearchParams<{ stationId: string; horizon?: string }>()
  const stationId = params.stationId ?? ''
  const horizon = parseHorizon(params.horizon ?? null)
  const insets = useSafeAreaInsets()
  const mapRef = useRef<NaverMapViewRef>(null)
  const { userLocation } = useMapView()
  // 출발지는 들어올 때 위치로 고정. 위치 추적으로 바뀌어도 경로를 다시 부르지 않음 (2026-11-22 결정)
  const [origin] = useState(userLocation)
  const {
    station,
    route,
    prediction,
    isStationError,
    isRouteError,
    isRouteUnavailable,
    isRouteRateLimited,
    routeRetryAfterSeconds,
    retryRoute,
  } = useRouteData(origin, stationId, horizon)

  // 경로가 시트에 가리지 않게 시트 높이를 재서 지도 안쪽 여백으로 씀
  const [sheetHeight, setSheetHeight] = useState(0)
  const [isMapReady, setIsMapReady] = useState(false)
  const topInset = insets.top + TOP_GAP + TOP_BUTTON_SIZE

  // 경로가 오면 경로 전체 + 도착지, 그 전(로딩 · 경로 없음)엔 출발지 · 도착지가 보이게 지도를 맞춤
  // 점선까지 보이게 도착지도 넣음. 경로 좌표가 그대로면 다시 맞추지 않음
  const path = route?.path
  const destinationLat = station?.lat
  const destinationLng = station?.lng
  useEffect(() => {
    // 지도가 준비되고 시트 높이를 잰 뒤, 도착지를 알 때만 맞춤
    if (!isMapReady || sheetHeight === 0) return
    if (destinationLat === undefined || destinationLng === undefined) return
    const destination: LatLng = { lat: destinationLat, lng: destinationLng }
    const points = path?.length
      ? [...path.map(([lat, lng]) => ({ lat, lng })), destination]
      : [origin, destination]
    const region = toRegion(points)
    // 맞출 범위가 있을 때만 카메라를 옮김
    if (region) mapRef.current?.animateRegionTo(region)
  }, [isMapReady, sheetHeight, path, destinationLat, destinationLng, origin])

  // 충전소 정보를 받은 뒤에만 목적지를 알 수 있어 그 전엔 null
  const destination = station ? { lat: station.lat, lng: station.lng, name: station.name } : null
  const waitRange = prediction
    ? formatWaitRange(
        prediction.waitTimeP50Minutes,
        prediction.waitTimeP90Minutes,
        prediction.congestion,
      )
    : null
  // 서버가 제공자를 안 보내면(전환 전 서버) 출처 줄을 비워 둠
  const providerLabel = route?.provider ? ROUTE_PROVIDER_LABEL[route.provider] : undefined

  // 다른 추천 충전소 보기 (05 → 02): 지도 홈 추천 시트를 펼친 채로 돌아감
  const showOtherRecommendations = () =>
    router.dismissTo({ pathname: '/', params: { expandSheet: '1' } })
  // 닫기 (05 → 02): 길찾기를 그만두고 지도 홈으로 돌아감
  const closeRoute = () => router.dismissTo('/')

  return (
    <View className="flex-1 bg-bg-map">
      <NaverMapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialCamera={{
          latitude: origin.lat,
          longitude: origin.lng,
          zoom: toAppZoom(INITIAL_WEB_ZOOM),
        }}
        // 경로를 화면에 맞출 때 위 버튼 · 아래 시트를 뺀 영역 안에 들어오게 함
        mapPadding={{
          top: topInset + FIT_MARGIN,
          bottom: sheetHeight + FIT_MARGIN,
          left: FIT_MARGIN,
          right: FIT_MARGIN,
        }}
        isShowLocationButton={false}
        isShowZoomControls={false}
        onInitialized={() => setIsMapReady(true)}
        // 출발지 표시 (웹 내 위치 마커). 들어올 때 고정한 출발지
        locationOverlay={{
          isVisible: true,
          position: { latitude: origin.lat, longitude: origin.lng },
        }}
      >
        {path && destination && <RouteOverlay path={path} destination={destination} />}
        {station && (
          <StationMarker
            station={station}
            isRecommended={false}
            isDot={false}
            isHideCollided={false}
            onTap={noop}
          />
        )}
      </NaverMapView>

      <View
        pointerEvents="box-none"
        style={{ top: insets.top + TOP_GAP }}
        className="absolute inset-x-4 flex-row justify-between"
      >
        <BackButton floating />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={closeRoute}
          hitSlop={8}
          style={FLOATING_BUTTON_SHADOW}
          className="size-10 items-center justify-center rounded-full bg-bg-page"
        >
          <X size={22} strokeWidth={2} color={COLORS['text-primary']} />
        </Pressable>
      </View>

      <View
        onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
        style={[
          SHEET_SHADOW,
          { paddingBottom: getFooterPaddingBottom(insets.bottom, SHEET_MIN_PADDING) },
        ]}
        className="absolute inset-x-0 bottom-0 gap-3.5 rounded-t-lg bg-bg-page px-4 pt-5"
      >
        {station ? (
          <View className="gap-1">
            <Text className="font-bold text-lg text-text-primary">{station.name}</Text>
            <Text className="font-sans text-[14px] text-text-secondary">{station.address}</Text>
          </View>
        ) : isStationError ? (
          <Text className="font-sans text-sm text-text-secondary">
            충전소 정보를 불러오지 못했습니다
          </Text>
        ) : (
          // 이름 · 주소 두 줄 자리를 미리 잡아 둠 (웹의 깜빡이는 회색 상자. 앱은 움직임 없이)
          <View className="gap-2 py-0.5">
            <View className="h-6 w-1/2 rounded-sm bg-bg-subtle" />
            <View className="h-4 w-2/3 rounded-sm bg-bg-subtle" />
          </View>
        )}

        {isRouteError ? (
          <>
            <View className="flex-row gap-2 rounded-sm bg-status-warning-bg px-3 py-2.5">
              <View className="mt-px">
                <TriangleAlert size={16} strokeWidth={2} color={COLORS['status-warning']} />
              </View>
              <KoreanText className="flex-1 font-sans text-[14px] text-status-warning">
                {/* 경로 없음 · 호출 제한 · 그 밖의 오류 순으로 안내를 고름 */}
                {isRouteUnavailable
                  ? '경로를 찾을 수 없어요. 다른 충전소를 선택해 주세요.'
                  : isRouteRateLimited
                    ? `요청이 많아 경로를 불러오지 못했어요.\n${getRetryWaitText(routeRetryAfterSeconds)} 다시 시도해 주세요.`
                    : '경로를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'}
              </KoreanText>
            </View>
            {/* 경로 없음은 다시 해도 같아서 재시도 버튼을 숨김 */}
            {!isRouteUnavailable && (
              <Button variant="secondary" onPress={() => void retryRoute()}>
                다시 시도
              </Button>
            )}
          </>
        ) : (
          // 경로를 받기 전에도 같은 칸 · 버튼 자리를 먼저 보여 줘, 다 받았을 때 시트 높이가 튀지 않게 함
          <>
            <View className="gap-1">
              <View className="flex-row gap-2">
                <SummaryTile
                  value={route ? `${route.travelTimeMinutes}분` : null}
                  label="자동차 소요"
                />
                <SummaryTile
                  value={route ? formatDistance(route.distanceMeters) : null}
                  label="거리"
                />
                {/* 지금 출발은 예상 대기 대신 실시간 사용 가능 대수 */}
                {horizon === 0 ? (
                  <SummaryTile
                    value={
                      station ? `${station.availableChargers}/${station.totalChargers}대` : null
                    }
                    label="지금 사용 가능"
                  />
                ) : (
                  <SummaryTile
                    value={station ? (waitRange ?? NO_PREDICTION_LABEL) : null}
                    label={`${getHorizonWhen(horizon)} 예상 대기`}
                  />
                )}
              </View>
              {/* 경로 출처. 받기 전에도 한 줄 자리를 잡아 다 받았을 때 시트 높이가 튀지 않게 함 */}
              <Text className="text-right font-sans text-[12px] text-text-secondary">
                {providerLabel ? `경로 정보: ${providerLabel}` : ' '}
              </Text>
            </View>
            {/* 경로를 찾는 동안은 안내 버튼 자리에 진행 중 표시 */}
            {route && destination ? (
              <View className="flex-row gap-2">
                <Button className="flex-1" onPress={() => openMapCarRoute('naver', destination)}>
                  네이버 지도로 안내
                </Button>
                <Button className="flex-1" onPress={() => openMapCarRoute('kakao', destination)}>
                  카카오맵으로 안내
                </Button>
              </View>
            ) : (
              <View
                accessibilityRole="button"
                accessibilityState={{ disabled: true, busy: true }}
                className="flex-row items-center justify-center gap-2 rounded-md bg-brand-primary px-4 py-3 opacity-50"
              >
                <ActivityIndicator size="small" color={COLORS['text-on-brand']} />
                <Text className="font-bold text-[16px] text-text-on-brand">경로를 찾고 있어요</Text>
              </View>
            )}
          </>
        )}

        {/* 경로를 못 받았으면 다른 충전소로 가는 이 버튼을 주 버튼으로 */}
        <Button variant={isRouteError ? 'primary' : 'secondary'} onPress={showOtherRecommendations}>
          AI 추천 충전소 보기
        </Button>
      </View>
    </View>
  )
}

/** 소요 · 거리 · 대기 칸. value가 null이면 아직 받는 중이라 값 자리에 회색 막대를 보여 줌 */
function SummaryTile({ value, label }: { value: string | null; label: string }) {
  return (
    <View className="min-w-0 flex-1 items-center gap-0.5 rounded-md bg-bg-subtle py-3">
      {value === null ? (
        <View className="my-1 h-5 w-12 rounded-sm bg-border-default" />
      ) : (
        <Text numberOfLines={1} className="font-bold text-lg text-text-primary">
          {value}
        </Text>
      )}
      <Text numberOfLines={1} className="font-sans text-xs text-text-secondary">
        {label}
      </Text>
    </View>
  )
}
