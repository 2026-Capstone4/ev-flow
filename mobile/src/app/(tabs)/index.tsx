import { NaverMapView, type NaverMapViewRef, type Region } from '@mj-studio/react-native-naver-map'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useMapHomeData } from '@ev-flow/core/hooks/useMapHomeData'
import { useMapView } from '@ev-flow/core/hooks/useMapView'
import { isDotStation, isInView, toViewBounds } from '@ev-flow/core/lib/mapMarkers'
import { hasSeenOnboarding, markOnboardingSeen } from '@ev-flow/core/lib/onboarding'
import { countActiveFilters } from '@ev-flow/core/lib/stationFilter'
import type { LatLng } from '@ev-flow/core/types/geo'
import type { Station } from '@ev-flow/core/types/station'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChargerIssuesButton } from '../../components/ChargerIssuesButton'
import { FilterPanel } from '../../components/FilterPanel'
import { LOCATE_BUTTON_SIZE, LocateButton } from '../../components/LocateButton'
import { MapNotice } from '../../components/MapNotice'
import { OnboardingDialog } from '../../components/OnboardingDialog'
import { RecommendSheet, type RecommendSheetHandle } from '../../components/RecommendSheet'
import { SearchBar } from '../../components/SearchBar'
import { UpdateStatus } from '../../components/UpdateStatus'
import { APP_LOCATE_FAILURE_MESSAGE, useCurrentLocation } from '../../hooks/useCurrentLocation'
import { INITIAL_MAP_CENTER, IS_GEOLOCATION_ENABLED } from '../../lib/config'
import { appStorage } from '../../lib/storage'
import { CoverageMask } from '../../map/CoverageMask'
import { SEOUL_EXTENT } from '../../map/seoulExtent'
import { StationMarker } from '../../map/StationMarker'
import { toAppZoom, toWebZoomLevel } from '../../map/zoom'

/** 첫 화면 줌 (웹 기준). 웹 지도 홈과 같은 넓이가 보이게 앱 줌으로 바꿔 씀 */
const INITIAL_WEB_ZOOM = 14

/**
 * 가장 멀리 볼 수 있는 앱 줌. 서울 전체(가로 약 37km)가 화면 가로에 겨우 들어오는 넓이
 * 앱 줌 14 = 가로 약 1.5km라 줌 9.3 = 약 39km (zoom.ts 측정 기준)
 */
const MIN_APP_ZOOM = 9.3

/** 화면 위아래 · 좌우로 화면 크기의 50%씩 더 넓게 마커를 미리 그림. 지도를 끌 때 마커가 늦게 뜨지 않게 함 (웹은 30%) */
const VIEW_MARGIN_RATIO = 0.5

/**
 * 이 웹 줌 이하에서는 마포 충전소도 숫자 대신 점으로 그림 (앱 줌 11 미만, 화면 가로 약 12km 넘게 보일 때)
 * 마포 숫자 마커가 한곳에 뭉쳐 덩어리가 되지 않게 함. 추천 Top 3는 눈에 띄게 숫자 그대로 둠
 */
const MAPO_DOT_MAX_ZOOM = 11

/** 이 충전소를 점으로 그릴지. core 기준(마포 밖, 웹 줌 13 이하)에 더해 멀리 보면 마포도 점 */
const isDotMarker = (webZoomLevel: number, station: Station, isRecommended: boolean) =>
  isDotStation(webZoomLevel, station, isRecommended) ||
  (webZoomLevel <= MAPO_DOT_MAX_ZOOM && !isRecommended)

/** 상태 표시줄 아래 검색창까지 띄우는 여백 (웹 top-4) */
const TOP_GAP = 16

/**
 * 겹친 점 마커를 SDK가 숨기게 할지. 서울 전역 색 점이 덜 빽빽해짐 (3단계 확인)
 * 숫자 마커는 StationMarker가 늘 빼서 겹쳐도 숨기지 않음
 */
const IS_HIDE_COLLIDED = true

/** 안내 문구를 띄워 두는 시간 */
const NOTICE_DURATION_MS = 3000

/** 현재 위치 버튼과 시트 위쪽 끝 사이 간격 (웹 mb-3) */
const LOCATE_BUTTON_GAP = 12

/** 카메라 상태. webZoomLevel은 core 줌 기준(점 · 숨김)에 넘기는 정수 단계 */
type CameraState = { webZoomLevel: number; region: Region | null }

// 지도 홈 (하단 탭 첫 번째). 데이터는 웹과 같은 core useMapHomeData
export default function MapHomeScreen() {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<NaverMapViewRef>(null)
  // 예측 시점 · 필터는 검색 화면과 함께 쓰고, 상세에서 뒤로 돌아와도 유지됨
  const { horizon, setHorizon, filters, setFilters, userLocation } = useMapView()
  const {
    stations,
    allStations,
    updatedAt,
    isStationsError,
    recommendations,
    recommendedIds,
    recommendState,
    recommendRetryAfterSeconds,
  } = useMapHomeData(userLocation, horizon, filters)

  const [camera, setCamera] = useState<CameraState>({
    webZoomLevel: INITIAL_WEB_ZOOM,
    region: null,
  })
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  // 검색 · 상세 · 휴게소 탭으로 떠나면 필터 패널을 닫음. 적용 안 한 고른 값이 돌아왔을 때 남아 있지 않게 함
  useFocusEffect(useCallback(() => () => setIsFilterOpen(false), []))
  // 추천 시트 펼침 높이 상한을 정하려고 지도 영역 높이를 잼
  const [containerHeight, setContainerHeight] = useState(0)

  // 화면 범위(+ 주변 여유)에 든 충전소만 마커로 그림
  // 웹은 웹 줌 11 이하에서 마커를 숨기지만, 앱은 최소 줌이 서울 전체라 멀리 봐도 모두 그림 (2026-11-21 실기기에서 확인)
  const visibleStations = useMemo(() => {
    // 처음 카메라 범위를 받기 전이면 그리지 않음
    if (!stations || !camera.region) return []
    const { latitude, longitude, latitudeDelta, longitudeDelta } = camera.region
    const view = toViewBounds(
      { lat: latitude, lng: longitude },
      { lat: latitude + latitudeDelta, lng: longitude + longitudeDelta },
      VIEW_MARGIN_RATIO,
    )
    return stations.filter((station) => isInView(station, view))
  }, [stations, camera])

  // 카메라가 멈췄을 때만 범위를 다시 계산함. 움직이는 동안은 SDK가 그대로 옮겨 그림
  const handleCameraIdle = useCallback(({ zoom, region }: { zoom?: number; region: Region }) => {
    // 줌을 못 받으면 첫 화면 줌으로 둠
    setCamera({
      webZoomLevel: zoom === undefined ? INITIAL_WEB_ZOOM : toWebZoomLevel(zoom),
      region,
    })
  }, [])

  // 처음 들어온 사용자에게만 사용법 안내를 띄움. 본 기록은 기기 저장소(expo-sqlite)에 남김
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => !hasSeenOnboarding(appStorage))
  /** 안내를 닫으면 본 것으로 기록해서 다음에 앱을 열 때부터는 띄우지 않음 */
  const closeOnboarding = useCallback(() => {
    markOnboardingSeen(appStorage)
    setIsOnboardingOpen(false)
  }, [])

  // 같은 문구가 연달아 와도 다시 3초를 세도록 띄울 때마다 id를 새로 붙임
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)
  useEffect(() => {
    // 띄운 문구가 없으면 셀 것도 없음
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), NOTICE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [notice])

  const { locate, isLocating } = useCurrentLocation()
  /** 줌은 그대로 두고 지도 가운데만 옮김 */
  const panTo = (target: LatLng) =>
    mapRef.current?.animateCameraTo({ latitude: target.lat, longitude: target.lng })
  // 웹 MapHomePage handleLocate와 같은 흐름
  const handleLocate = async () => {
    // 기능이 꺼져 있으면 GPS 없이 지금 기준 위치(시연 위치)로 지도만 옮김
    if (!IS_GEOLOCATION_ENABLED) {
      panTo(userLocation)
      return
    }
    const result = await locate()
    // 찾았으면 그 위치로, 마포구 밖이면 지금 추천 기준 위치로 지도를 옮김
    if (result.ok || result.reason === 'out-of-area') {
      panTo(result.ok ? result.location : userLocation)
    }
    // 못 쓴 이유는 잠깐 안내 (권한 거부 · 위치 서비스 꺼짐 · 마포구 밖 등)
    if (!result.ok) {
      setNotice({ id: Date.now(), message: APP_LOCATE_FAILURE_MESSAGE[result.reason] })
    }
  }

  // 현재 위치 버튼은 시트 위에 붙어 함께 움직이고, 시트를 펼칠수록 흐려짐 (웹과 같음)
  // 시트가 위쪽 끝 위치 · 단계 번호를 UI 스레드 값에 써 주고, 버튼은 그 값으로 자리 · 투명도를 정함
  const sheetPosition = useSharedValue(0)
  const sheetIndex = useSharedValue(1)
  const [isSheetExpanded, setIsSheetExpanded] = useState(false)
  const locateButtonStyle = useAnimatedStyle(() => ({
    top: sheetPosition.value - LOCATE_BUTTON_SIZE - LOCATE_BUTTON_GAP,
    // 접힘(1) → 펼침(2)으로 갈수록 0에 가까워짐. 최소 · 접힘에서는 그대로 보임
    opacity: interpolate(sheetIndex.value, [1, 2], [1, 0], Extrapolation.CLAMP),
  }))

  // 마커는 시점이 바뀔 때마다 다시 그리지 않도록 최신 시점만 ref로 읽음
  const horizonRef = useRef(horizon)
  useEffect(() => {
    horizonRef.current = horizon
  }, [horizon])
  const openStation = useCallback(
    (stationId: string) =>
      router.push({
        pathname: '/stations/[stationId]',
        params: { stationId, horizon: String(horizonRef.current) },
      }),
    [],
  )
  // 추천 카드의 길찾기 버튼 → 길찾기 화면 (웹 /stations/{id}/route?horizon=)
  const openRoute = useCallback(
    (station: Pick<Station, 'stationId'>) =>
      router.push({
        pathname: '/stations/[stationId]/route',
        params: { stationId: station.stationId, horizon: String(horizonRef.current) },
      }),
    [],
  )

  // 길찾기 화면의 "AI 추천 충전소 보기"로 돌아오면(?expandSheet=1) 추천 시트를 펼침 (웹 state.expandSheet)
  const sheetRef = useRef<RecommendSheetHandle>(null)
  const { expandSheet } = useLocalSearchParams<{ expandSheet?: string }>()
  useEffect(() => {
    // 펼쳐 달라는 값이 없으면 그대로 둠
    if (expandSheet !== '1') return
    sheetRef.current?.expand()
    // 한 번 펼친 뒤 값을 지워서 탭을 오가도 다시 펼치지 않게 함
    router.setParams({ expandSheet: undefined })
  }, [expandSheet])

  // memo 마커가 다시 그려지지 않도록 함수 하나를 계속 씀
  const handleMarkerTap = useCallback(
    (station: Station) => openStation(station.stationId),
    [openStation],
  )

  return (
    <View
      className="flex-1 bg-bg-map"
      onLayout={(event) => setContainerHeight(event.nativeEvent.layout.height)}
    >
      <NaverMapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialCamera={{
          latitude: INITIAL_MAP_CENTER.lat,
          longitude: INITIAL_MAP_CENTER.lng,
          zoom: toAppZoom(INITIAL_WEB_ZOOM),
        }}
        isShowLocationButton={false}
        minZoom={MIN_APP_ZOOM}
        // 서비스 지역(서울) 밖으로 지도를 끌어가지 않게 지도 가운데를 서울 사각형 안으로 묶음
        extent={SEOUL_EXTENT}
        isShowZoomControls={false}
        onCameraIdle={handleCameraIdle}
        // 추천 · 검색 기준 위치 표시 (웹 내 위치 마커). 시연 위치이거나 현재 위치 버튼으로 바꾼 위치
        locationOverlay={{
          isVisible: true,
          position: { latitude: userLocation.lat, longitude: userLocation.lng },
        }}
      >
        <CoverageMask />
        {visibleStations.map((station) => {
          const isRecommended = recommendedIds.has(station.stationId)
          return (
            <StationMarker
              key={station.stationId}
              station={station}
              isRecommended={isRecommended}
              isDot={isDotMarker(camera.webZoomLevel, station, isRecommended)}
              isHideCollided={IS_HIDE_COLLIDED}
              onTap={handleMarkerTap}
            />
          )
        })}
      </NaverMapView>

      {containerHeight > 0 && (
        <RecommendSheet
          ref={sheetRef}
          recommendations={recommendations}
          recommendState={recommendState}
          retryAfterSeconds={recommendRetryAfterSeconds}
          horizon={horizon}
          onHorizonChange={setHorizon}
          onSelect={openStation}
          onRouteSelect={openRoute}
          containerHeight={containerHeight}
          animatedPosition={sheetPosition}
          animatedIndex={sheetIndex}
          onExpandedChange={setIsSheetExpanded}
        />
      )}

      {/* 현재 위치 버튼. 시트를 펼친 동안은 흐려지고 누를 수 없음 */}
      {containerHeight > 0 && (
        <Animated.View
          pointerEvents={isSheetExpanded ? 'none' : 'box-none'}
          accessibilityElementsHidden={isSheetExpanded}
          style={[{ position: 'absolute', right: 16 }, locateButtonStyle]}
        >
          <LocateButton isLocating={isLocating} onPress={handleLocate} />
        </Animated.View>
      )}

      {/* 필터 패널이 열린 동안 바깥(지도 · 시트)을 누르면 고른 값을 버리고 닫음 */}
      {isFilterOpen && (
        <Pressable
          accessibilityLabel="필터 닫기"
          onPress={() => setIsFilterOpen(false)}
          className="absolute inset-0"
        />
      )}

      {/* 상단 검색창 · 갱신 상태. 지도 터치를 막지 않게 필요한 곳만 누를 수 있음 */}
      <View
        pointerEvents="box-none"
        style={{ paddingTop: insets.top + TOP_GAP }}
        className="absolute inset-x-0 top-0 items-start gap-2 px-4"
      >
        {/* 패널은 검색창 기준으로 띄워서 아래 갱신 상태 · 안내를 밀어내지 않고 덮음 */}
        <View className="z-10 w-full">
          <SearchBar
            activeFilterCount={countActiveFilters(filters)}
            isFilterOpen={isFilterOpen}
            onSearchPress={() => router.push('/search')}
            onFilterPress={() => setIsFilterOpen(!isFilterOpen)}
          />
          {isFilterOpen && (
            <View className="absolute inset-x-0 top-full mt-2">
              <FilterPanel
                filters={filters}
                allStations={allStations}
                onApply={(next) => {
                  setFilters(next)
                  setIsFilterOpen(false)
                }}
              />
            </View>
          )}
        </View>
        {/* 왼쪽 갱신 상태, 오른쪽 상태 이상 충전기 버튼 (검색창 오른쪽 아래) */}
        <View
          pointerEvents="box-none"
          className="w-full flex-row items-start justify-between gap-2"
        >
          <UpdateStatus updatedAt={updatedAt} isError={isStationsError} />
          <ChargerIssuesButton onPress={() => router.push('/charger-issues')} />
        </View>
        {notice && <MapNotice key={notice.id} message={notice.message} />}
      </View>
      {isOnboardingOpen && <OnboardingDialog onClose={closeOnboarding} />}
    </View>
  )
}
