import {
  NaverMapView,
  type Camera,
  type NaverMapViewRef,
  type Region,
} from '@mj-studio/react-native-naver-map'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import {
  Car,
  Clock,
  Map as MapIcon,
  MapPin,
  Navigation,
  Route,
  Search,
  SlidersHorizontal,
  Sparkles,
  Timer,
} from 'lucide-react-native'
import { useMapHomeData } from '@ev-flow/core/hooks/useMapHomeData'
import { useMapView } from '@ev-flow/core/hooks/useMapView'
import { usePrefetchNationwideServiceAreas } from '@ev-flow/core/hooks/useServiceAreasQuery'
import { isDotStation, isInView, toViewBounds } from '@ev-flow/core/lib/mapMarkers'
import {
  APP_ONBOARDING_STORAGE_KEY,
  hasSeenOnboarding,
  markOnboardingSeen,
} from '@ev-flow/core/lib/onboarding'
import { countActiveFilters } from '@ev-flow/core/lib/stationFilter'
import { RADIUS } from '@ev-flow/core/lib/theme'
import type { LatLng } from '@ev-flow/core/types/geo'
import type { Station } from '@ev-flow/core/types/station'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  View,
  type GestureResponderEvent,
} from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChargerIssuesButton } from '../../components/ChargerIssuesButton'
import { CompassButton } from '../../components/CompassButton'
import { FilterPanel } from '../../components/FilterPanel'
import { LOCATE_BUTTON_SIZE, LocateButton } from '../../components/LocateButton'
import { MapNotice } from '../../components/MapNotice'
import { AppLogoMark } from '../../components/AppLogoMark'
import {
  ONBOARDING_SAMPLE_RECOMMENDATION,
  OnboardingTour,
  type TourStep,
} from '../../components/OnboardingTour'
import { RecommendSheet, type RecommendSheetHandle } from '../../components/RecommendSheet'
import { SearchBar } from '../../components/SearchBar'
import { UpdateNoticeModal } from '../../components/UpdateNoticeModal'
import { UpdateStatus } from '../../components/UpdateStatus'
import { useAppUpdateNotice } from '../../hooks/useAppUpdateNotice'
import { APP_LOCATE_FAILURE_MESSAGE, useCurrentLocation } from '../../hooks/useCurrentLocation'
import { useLocationTracking } from '../../hooks/useLocationTracking'
import { INITIAL_MAP_CENTER, IS_GEOLOCATION_ENABLED } from '../../lib/config'
import { appStorage } from '../../lib/storage'
import {
  measureTourTarget,
  tourTargetRef,
  type TourRect,
  type ViewInstance,
} from '../../lib/tourTargets'
import { CoverageMask } from '../../map/CoverageMask'
import { KOREA_EXTENT } from '../../map/koreaExtent'
import { getPillSize, StationMarker } from '../../map/StationMarker'
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
 * 겹친 점 마커를 SDK가 숨기게 할지. 숨기면 지도에서 찾을 수 없는 충전소가 생기고,
 * 지도를 끄는 동안 SDK가 마커 1,600여 개의 겹침을 계속 다시 계산해 느려져서 끔
 * 숫자 마커는 StationMarker가 늘 빼서 겹쳐도 숨기지 않음
 */
const IS_HIDE_COLLIDED = false

/** 안내 문구를 띄워 두는 시간 */
const NOTICE_DURATION_MS = 3000

/**
 * 첫 방문 안내를 닫은 뒤 새 버전 안내 창을 띄우기까지 기다리는 시간
 * iOS는 앞 Modal이 fade로 닫히는 중에 다음 Modal을 열면 조용히 안 뜰 수 있어, 닫힘(약 0.3초)이 끝난 뒤 띄움
 */
const UPDATE_NOTICE_DELAY_MS = 500

/**
 * 지도를 '탭'으로 볼 기준. 손을 뗀 순간 바로 시트를 내림
 * SDK onTapMap은 두 번 탭(확대)인지 기다렸다 불려서 늦게 반응해서 직접 판단함
 * Android는 지도 네이티브 뷰가 터치를 가져가 바깥 View에 손 뗀 순간이 오지 않아서 onTapMap을 씀
 */
const IS_MAP_TAP_BY_TOUCH = Platform.OS !== 'android'
const MAP_TAP_MAX_MS = 250
const MAP_TAP_MAX_MOVE = 10

/** 현재 위치 버튼과 시트 위쪽 끝 사이 간격 (웹 mb-3) */
const LOCATE_BUTTON_GAP = 12

/** 나침반 버튼과 현재 위치 버튼 사이 간격 */
const COMPASS_BUTTON_GAP = 8

/** 이 각도(도)보다 덜 돌아가거나 기울었으면 정방향으로 보고 나침반을 숨김. 되돌리는 애니메이션 끝의 작은 오차를 무시함 */
const COMPASS_HIDE_DEGREES = 0.5

/** 나침반이 나타나고 사라지는 시간 */
const COMPASS_FADE_MS = 150

/** 지도가 돌아가거나 기울어 있는지 */
const isMapRotated = ({ bearing = 0, tilt = 0 }: Pick<Camera, 'bearing' | 'tilt'>) => {
  // bearing은 0~360이라 359.9도 거의 정방향으로 봄
  const turned = Math.min(Math.abs(bearing), Math.abs(360 - bearing))
  return turned > COMPASS_HIDE_DEGREES || tilt > COMPASS_HIDE_DEGREES
}

/**
 * 첫 방문 안내가 마커를 짚을 때 칸을 오른쪽으로 옮기는 만큼. 실제 마커 그림 위치에 맞춤
 * Android는 지도 SDK가 마커를 화면 좌표보다 1dp 오른쪽에 그려서 그만큼 옮기고, iOS는 좌표 그대로 맞음 (11/26 화면 픽셀로 확인)
 */
const TOUR_MARKER_OFFSET_X = Platform.OS === 'android' ? 1 : 0

/** 짚을 마커를 고를 때 화면 가장자리에서 이만큼 안쪽만 봄. 카드 · 버튼에 가리지 않게 함 */
const TOUR_MARKER_EDGE = 48

/** 짚을 마커 후보로 화면에 찍어 볼 충전소 수. 가운데에서 가까운 순 */
const TOUR_MARKER_TRIES = 8

/** View의 창 기준 위치 · 크기를 잼 */
const measureView = (view: ViewInstance) =>
  new Promise<TourRect>((resolve) => {
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }))
  })

/** 카메라 상태. webZoomLevel은 core 줌 기준(점 · 숨김)에 넘기는 정수 단계 */
type CameraState = { webZoomLevel: number; region: Region | null }

// 지도 홈 (하단 탭 첫 번째). 데이터는 웹과 같은 core useMapHomeData
export default function MapHomeScreen() {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<NaverMapViewRef>(null)
  // 예측 시점 · 필터는 검색 화면과 함께 쓰고, 상세에서 뒤로 돌아와도 유지됨
  const { horizon, setHorizon, filters, setFilters, userLocation } = useMapView()
  // 처음 위치 재기(아래 온보딩 뒤 locate)가 끝났는지. 끝나기 전에는 추천을 부르지 않음
  // 시연 위치로 먼저 부르면 실제 위치로 한 번 더 불러야 해서 호출을 아낌. 위치 기능이 꺼진 빌드는 바로 부름
  const [isStartLocateDone, setIsStartLocateDone] = useState(!IS_GEOLOCATION_ENABLED)
  const {
    stations,
    allStations,
    updatedAt,
    isStationsError,
    recommendations,
    recommendedIds,
    recommendState,
  } = useMapHomeData(horizon, filters, isStartLocateDone)
  // 지도 충전소를 받은 뒤 휴게소 목록도 미리 받아 둬서, 휴게소 탭을 열면 바로 목록이 보이게 함
  usePrefetchNationwideServiceAreas(updatedAt !== null)

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
  // 앱 전용 키(app-v2)라 안내가 바뀌기 전에 본 사용자도 한 번 더 봄
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(
    () => !hasSeenOnboarding(appStorage, APP_ONBOARDING_STORAGE_KEY),
  )
  /** 안내를 닫으면 본 것으로 기록해서 다음에 앱을 열 때부터는 띄우지 않음 */
  const closeOnboarding = useCallback(() => {
    markOnboardingSeen(appStorage, APP_ONBOARDING_STORAGE_KEY)
    setIsOnboardingOpen(false)
    // 더보기에서 다시 보기로 열었으면 그 값도 지워서, 탭을 오가도 다시 뜨지 않게 함
    router.setParams({ showOnboarding: undefined })
  }, [])

  // 스토어에 새 버전이 나왔으면 안내함 (evflowkr.app/app-version.json)
  const {
    notice: updateNotice,
    currentVersion,
    dismiss: dismissUpdate,
    openStore,
  } = useAppUpdateNotice()

  // 같은 문구가 연달아 와도 다시 3초를 세도록 띄울 때마다 id를 새로 붙임
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)
  useEffect(() => {
    // 띄운 문구가 없으면 셀 것도 없음
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), NOTICE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [notice])

  /** 지도를 누르기 시작한 시각 · 위치. 한 손가락일 때만 둠 */
  const mapTouchRef = useRef<{ time: number; x: number; y: number } | null>(null)
  const handleMapTouchStart = (event: GestureResponderEvent) => {
    const { touches, pageX, pageY } = event.nativeEvent
    // 두 손가락(확대 · 회전)은 탭이 아니라서 기록을 지움
    mapTouchRef.current = touches.length === 1 ? { time: Date.now(), x: pageX, y: pageY } : null
  }
  // 짧게 누르고 거의 안 움직였으면 탭으로 보고 바로 내림. 지도를 끈 경우는 그대로 둠
  // 마커를 탭해도 내려가지만 마커는 상세 화면으로 넘어가서 상관없음
  const handleMapTouchEnd = (event: GestureResponderEvent) => {
    const start = mapTouchRef.current
    mapTouchRef.current = null
    // 시작 기록이 없으면(두 손가락) 탭이 아님
    if (!start) return
    const { pageX, pageY } = event.nativeEvent
    const isShort = Date.now() - start.time <= MAP_TAP_MAX_MS
    const isStill = Math.hypot(pageX - start.x, pageY - start.y) <= MAP_TAP_MAX_MOVE
    // 짧고 거의 안 움직인 터치만 시트를 내림
    if (isShort && isStill) sheetRef.current?.minimize()
  }
  /** Android 지도 탭(SDK 이벤트)에서 시트를 최소로 내림 */
  const minimizeSheet = useCallback(() => sheetRef.current?.minimize(), [])

  const { locate, isLocating } = useCurrentLocation()
  // 위치 권한이 이미 있으면 앱이 켜져 있는 동안 위치를 따라감. 추천은 500m · 2분 · 5분 규칙으로만 다시 부름
  const { recheck: recheckTracking } = useLocationTracking(IS_GEOLOCATION_ENABLED)
  /** 줌은 그대로 두고 지도 가운데만 옮김 */
  const panTo = (target: LatLng) =>
    mapRef.current?.animateCameraTo({ latitude: target.lat, longitude: target.lng })
  // 웹 MapHomePage handleLocate와 같은 흐름. 지도만 옮기고 추천은 바로 부르지 않음 (2026-11-22 결정)
  const handleLocate = async () => {
    // 기능이 꺼져 있으면 GPS 없이 지금 기준 위치(시연 위치)로 지도만 옮김
    if (!IS_GEOLOCATION_ENABLED) {
      panTo(userLocation)
      return
    }
    const result = await locate()
    // 이 버튼으로 처음 권한을 허용했으면 그때부터 위치를 따라감
    recheckTracking()
    // 찾았으면 그 위치로 지도를 옮김 (마포구 밖이어도 옮김)
    if (result.ok) {
      panTo(result.location)
      return
    }
    // 예전에 거부해 OS가 더 묻지 않으면 설정 앱으로 갈지 물음. 허용하고 돌아오면 useLocationTracking이 다시 확인함
    if (result.isBlocked) {
      Alert.alert(
        '위치 권한이 꺼져 있어요',
        '현재 위치를 보려면 설정 앱에서\nEV Flow의 위치 접근을 허용해 주세요.',
        [
          { text: '취소', style: 'cancel' },
          { text: '설정 열기', onPress: () => Linking.openSettings() },
        ],
      )
      return
    }
    // 못 쓴 이유는 잠깐 안내 (방금 거부 · 위치 서비스 꺼짐 · 시간 초과 등)
    setNotice({ id: Date.now(), message: APP_LOCATE_FAILURE_MESSAGE[result.reason] })
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

  // 나침반은 늘 그려 두고 투명도로만 보이고 숨김
  // 그리기 · 지우기로 하면 화면 배치가 바뀌는 순간과 버튼 자리 값이 바뀌는 순간이 한 프레임 어긋나 현재 위치 버튼이 튐
  // 회전 각도 · 보이기는 UI 스레드 값이라 지도가 움직이는 동안 화면을 다시 그리지 않음
  const mapBearing = useSharedValue(0)
  const compassOpacity = useSharedValue(0)
  // 누를 수 있는지만 화면 상태로 둠. 정방향 ↔ 돌아감이 바뀔 때만 바뀜
  const [isCompassVisible, setIsCompassVisible] = useState(false)
  const isCompassVisibleRef = useRef(false)
  const compassButtonStyle = useAnimatedStyle(() => ({
    top: sheetPosition.value - LOCATE_BUTTON_SIZE * 2 - LOCATE_BUTTON_GAP - COMPASS_BUTTON_GAP,
    // 시트를 펼칠수록 현재 위치 버튼과 함께 흐려짐
    opacity:
      compassOpacity.value * interpolate(sheetIndex.value, [1, 2], [1, 0], Extrapolation.CLAMP),
  }))
  // 지도가 움직이는 동안 매 프레임 불려서 UI 스레드 값만 바꾸고 바로 끝냄
  const handleCameraChanged = useCallback(
    ({ bearing, tilt }: Pick<Camera, 'bearing' | 'tilt'>) => {
      mapBearing.set(bearing ?? 0)
      const isRotated = isMapRotated({ bearing, tilt })
      // 보이기 상태가 그대로면 할 일이 없음
      if (isRotated === isCompassVisibleRef.current) return
      isCompassVisibleRef.current = isRotated
      compassOpacity.set(withTiming(isRotated ? 1 : 0, { duration: COMPASS_FADE_MS }))
      setIsCompassVisible(isRotated)
    },
    [mapBearing, compassOpacity],
  )
  /** 위치 · 줌은 그대로 두고 북쪽이 위로, 기울기는 평평하게 되돌림 */
  const resetHeading = () => mapRef.current?.animateCameraResetHeading()

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
  const { expandSheet, showOnboarding } = useLocalSearchParams<{
    expandSheet?: string
    showOnboarding?: string
  }>()

  // 온보딩이 끝나면(다시 연 사용자는 화면을 열자마자) 한 번 위치를 잼
  // 처음이면 여기서 iOS 권한 창이 뜨고, 이미 정했으면 창 없이 현재 위치로 지도를 옮김
  // 거부하면 시연 위치(마포구)에 그대로 둠. 방금 고른 결과라 안내 문구는 띄우지 않음
  // 성공 · 실패와 상관없이 끝나면 첫 추천을 부름 (찾았으면 그 위치, 못 찾았으면 시연 위치)
  const hasLocatedOnStartRef = useRef(false)
  const isOnboardingVisible = isOnboardingOpen || showOnboarding === '1'

  // 새 버전 안내는 첫 방문 안내가 완전히 닫힌 뒤에만 띄움. 안내를 다시 열면 그동안 바로 숨김
  // 닫힌 상태가 0.5초 이어졌는지를 따로 두고, 지금 안내가 떠 있는지와 함께 봄
  const [isOnboardingSettledHidden, setIsOnboardingSettledHidden] = useState(false)
  useEffect(() => {
    const timer = setTimeout(
      () => setIsOnboardingSettledHidden(!isOnboardingVisible),
      // 닫혔을 때만 기다리고, 열렸을 때는 바로 기록함
      isOnboardingVisible ? 0 : UPDATE_NOTICE_DELAY_MS,
    )
    return () => clearTimeout(timer)
  }, [isOnboardingVisible])
  const isUpdateNoticeReady = isOnboardingSettledHidden && !isOnboardingVisible

  useEffect(() => {
    // 위치 기능이 꺼진 빌드 · 안내를 보는 중 · 이미 한 번 잰 경우는 건너뜀
    if (!IS_GEOLOCATION_ENABLED || isOnboardingVisible || hasLocatedOnStartRef.current) return
    hasLocatedOnStartRef.current = true
    locate().then((result) => {
      setIsStartLocateDone(true)
      recheckTracking()
      // 찾았으면 그 위치로 지도를 옮김
      if (result.ok) panTo(result.location)
    })
    // 처음 한 번만 부르면 돼서 함수들은 의존성에서 뺌
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnboardingVisible])

  // 안내를 열면 추천 시트를 접힘(첫 카드)으로 맞춤. 지도를 탭해 내려 둔 채 다시 보기로 열어도 예시 카드가 보이게 함
  useEffect(() => {
    // 안내가 닫혀 있으면 시트는 사용자가 둔 그대로
    if (!isOnboardingVisible) return
    sheetRef.current?.collapse()
  }, [isOnboardingVisible])

  useEffect(() => {
    // 펼쳐 달라는 값이 없으면 그대로 둠
    if (expandSheet !== '1') return
    sheetRef.current?.expand()
    // 한 번 펼친 뒤 값을 지워서 탭을 오가도 다시 펼치지 않게 함
    router.setParams({ expandSheet: undefined })
  }, [expandSheet])

  // Android 뒤로 가기는 열린 것부터 닫음: 필터 패널 → 펼친 추천 시트(접힘으로) → 기본 동작(앱 나가기)
  // 이 화면이 보일 때만 듣고, 첫 방문 안내(Modal)가 열려 있으면 Modal이 먼저 받아서 여기까지 안 옴
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        // 필터 패널이 열려 있으면 고른 값을 버리고 닫음 (바깥을 누른 것과 같음)
        if (isFilterOpen) {
          setIsFilterOpen(false)
          return true
        }
        // 시트가 펼쳐져 있거나 펼쳐지는 중이면 접힘으로 내림
        if (sheetRef.current?.isExpanding()) {
          sheetRef.current.collapse()
          return true
        }
        return false
      })
      return () => subscription.remove()
    }, [isFilterOpen]),
  )

  // memo 마커가 다시 그려지지 않도록 함수 하나를 계속 씀
  const handleMarkerTap = useCallback(
    (station: Station) => openStation(station.stationId),
    [openStation],
  )

  // 첫 방문 안내가 짚을 칸을 잴 때 쓰는 최신 값. 안내 단계 목록을 한 번만 만들려고 ref로 읽음
  const containerRef = useRef<ViewInstance>(null)
  const tourStateRef = useRef({ visibleStations, recommendedIds, camera })
  useEffect(() => {
    tourStateRef.current = { visibleStations, recommendedIds, camera }
  }, [visibleStations, recommendedIds, camera])

  /**
   * 화면에 보이는 숫자 마커 중 가운데에서 가까운 하나의 칸을 잼
   * 검색창 아래 · 추천 시트 위에 온전히 보이는 마커만 고르고, 없으면 null (가운데 카드로 대신 보여 줌)
   */
  const measureNearMarker = useCallback(async (): Promise<TourRect | null> => {
    const map = mapRef.current
    const container = containerRef.current
    const { visibleStations: shown, recommendedIds: picked, camera: current } = tourStateRef.current
    // 지도 · 카메라 범위를 아직 못 받았으면 고를 마커가 없음
    if (!map || !container || !current.region) return null
    const { latitude, longitude, latitudeDelta, longitudeDelta } = current.region
    const center = { lat: latitude + latitudeDelta / 2, lng: longitude + longitudeDelta / 2 }
    const candidates = shown
      // 추천 마커(하늘색)는 빼고 혼잡도 색 숫자 마커만 고름. 이 장은 여유 · 보통 · 혼잡 색을 설명함
      // 다시 보기로 열면 실제 추천 결과가 남아 있어서 추천 마커가 가운데에 있을 수 있음
      .filter(
        (station) =>
          !picked.has(station.stationId) && !isDotMarker(current.webZoomLevel, station, false),
      )
      .sort(
        (a, b) =>
          Math.hypot(a.lat - center.lat, a.lng - center.lng) -
          Math.hypot(b.lat - center.lat, b.lng - center.lng),
      )
      .slice(0, TOUR_MARKER_TRIES)
    const origin = await measureView(container)
    const searchBar = await measureTourTarget('search-bar')
    // 검색창 · 갱신 상태 줄 아래부터, 추천 시트 위쪽 끝 바로 위까지만 봄
    const minY = (searchBar ? searchBar.y + searchBar.height : origin.y) + TOUR_MARKER_EDGE
    const maxY = origin.y + sheetPosition.get() - TOUR_MARKER_EDGE
    for (const station of candidates) {
      const point = await map.coordinateToScreen({ latitude: station.lat, longitude: station.lng })
      // 화면 밖이라 위치를 못 받으면 다음 후보로
      if (!point.isValid) continue
      const x = origin.x + point.screenX
      const y = origin.y + point.screenY
      const isInside =
        x >= origin.x + TOUR_MARKER_EDGE &&
        x <= origin.x + origin.width - TOUR_MARKER_EDGE &&
        y >= minY &&
        y <= maxY
      // 가려지는 자리에 있으면 다음 후보로
      if (!isInside) continue
      // 마커 알약은 가운데가 충전소 위치라, 그 둘레로 알약 크기만큼 잡음
      const pill = getPillSize(station)
      // Android 지도 SDK는 마커 그림을 오른쪽으로 조금 치우쳐 그려서 칸도 그만큼 옮김
      return { x: x - pill.width / 2 + TOUR_MARKER_OFFSET_X, y: y - pill.height / 2, ...pill }
    }
    return null
    // sheetPosition은 같은 공유 값이 계속 이어져서 한 번만 만들면 됨
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 추천 시트가 지금 보이는 칸(시트 위쪽 끝 ~ 지도 영역 아래 끝)을 잼 */
  const measureSheet = useCallback(async (): Promise<TourRect | null> => {
    const container = containerRef.current
    // 지도 영역이 아직 없으면 잴 수 없음
    if (!container) return null
    const origin = await measureView(container)
    const top = sheetPosition.get()
    return { x: origin.x, y: origin.y + top, width: origin.width, height: origin.height - top }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 첫 방문 안내 5장. 첫 장은 서비스 소개, 나머지는 실제 화면을 한 곳씩 짚음
  // 장 목록이 바뀌면 안내가 칸을 다시 재서 한 번만 만듦 (짚을 칸은 잴 때 ref로 최신 값을 읽음)
  const tourSteps = useMemo<TourStep[]>(
    () => [
      {
        // 앱 아이콘의 E + 번개를 브랜드 색 한 가지로 그림
        icon: AppLogoMark,
        title: 'EV Flow',
        body: 'AI 전기차 충전소 추천',
        points: [
          { icon: Clock, text: '출발 전에 혼잡도를 미리 확인해요' },
          { icon: Sparkles, text: '도착할 때 덜 붐빌 곳을 골라 드려요' },
        ],
        isIntro: true,
      },
      {
        icon: MapPin,
        title: '충전소 혼잡도를 한눈에',
        body: '지도 위 숫자와 색으로\n지금 얼마나 붐비는지 보여 줘요.',
        markerExample: {
          text: '3/4',
          className: 'bg-congestion-free',
          caption: '빈 충전기 3대 / 전체 4대',
        },
        legend: [
          { label: '여유', className: 'bg-congestion-free' },
          { label: '보통', className: 'bg-congestion-normal' },
          { label: '혼잡', className: 'bg-congestion-busy' },
        ],
        measure: measureNearMarker,
        // 알약 모양이라 높이의 절반만큼 둥글게. 알약 높이는 글자 수와 상관없이 같음
        holeRadius: getPillSize({ availableChargers: 0, totalChargers: 0 }).height / 2,
      },
      {
        icon: Sparkles,
        title: '덜 붐빌 곳을 추천해요',
        body: '도착 시점에 맞춰 고른\n추천 충전소 3곳이 이렇게 떠요.',
        markerExample: {
          text: '2/2',
          className: 'bg-marker-recommended',
          caption: '지도에서는 이 색으로 표시해요',
        },
        points: [
          // 15 · 30분 후 추천은 서버가 마포구만 지원함 (추천 시트 out_of_area 문구와 같은 범위)
          { icon: Timer, text: '15분 · 30분 후 출발도 비교해요', note: '지금은 마포구만 지원해요' },
          { icon: Navigation, text: '길찾기로 바로 출발해요' },
        ],
        measure: measureSheet,
        // 시트는 위쪽 모서리만 둥글고 아래는 하단 탭에 붙어 있음
        holeRadius: RADIUS.lg,
        holeBottomRadius: 0,
      },
      {
        icon: Search,
        title: '원하는 충전소만 골라 보기',
        body: '검색창과 필터로\n필요한 충전소만 남겨요.',
        points: [
          { icon: Search, text: '충전소 이름 · 주소로 찾기' },
          { icon: SlidersHorizontal, text: '급속 · 커넥터 · 사용 가능만 보기' },
        ],
        measure: () => measureTourTarget('search-bar'),
        holeRadius: RADIUS.md,
      },
      {
        icon: Car,
        title: '고속도로 휴게소도 한눈에',
        body: '이 탭에서 전국 고속도로 휴게소\n충전소의 혼잡도를 볼 수 있어요.',
        points: [
          { icon: Route, text: '고속도로 노선별로 보기' },
          { icon: MapIcon, text: '시 · 도 지역별로 모아 보기' },
        ],
        measure: () => measureTourTarget('service-areas-tab'),
        holeRadius: RADIUS.md,
      },
    ],
    [measureNearMarker, measureSheet],
  )

  return (
    <View
      ref={containerRef}
      className="flex-1 bg-bg-map"
      onLayout={(event) => setContainerHeight(event.nativeEvent.layout.height)}
    >
      {/* 지도를 탭하면 추천 시트를 최소로 내려 지도를 넓게 봄. 손가락 움직임만 보고 지도 터치는 막지 않음 */}
      <View
        className="flex-1"
        onTouchStart={IS_MAP_TAP_BY_TOUCH ? handleMapTouchStart : undefined}
        onTouchEnd={IS_MAP_TAP_BY_TOUCH ? handleMapTouchEnd : undefined}
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
          // 대한민국 밖으로 지도를 끌어가지 않게 지도 가운데를 대한민국 사각형 안으로 묶음 (제주도까지)
          extent={KOREA_EXTENT}
          isShowZoomControls={false}
          // SDK 나침반은 왼쪽 위 검색창에 가려서 끄고, 현재 위치 버튼 위에 따로 띄움
          isShowCompass={false}
          onCameraChanged={handleCameraChanged}
          onCameraIdle={handleCameraIdle}
          // Android만 지도 빈 곳 탭으로 시트를 최소로 내림. 마커 탭은 SDK가 먼저 받아서 여기로 오지 않음
          onTapMap={IS_MAP_TAP_BY_TOUCH ? undefined : minimizeSheet}
          // 추천 · 검색 기준 위치 표시 (웹 내 위치 마커). 시연 위치이거나 현재 위치 버튼으로 바꾼 위치
          locationOverlay={{
            isVisible: true,
            position: { latitude: userLocation.lat, longitude: userLocation.lng },
          }}
        >
          <CoverageMask onTap={IS_MAP_TAP_BY_TOUCH ? undefined : minimizeSheet} />
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
      </View>

      {containerHeight > 0 && (
        <RecommendSheet
          ref={sheetRef}
          // 안내를 보는 동안은 예시 추천 1곳을 보여 줌. 안내를 닫으면 실제 추천으로 돌아감
          recommendations={
            isOnboardingVisible ? [ONBOARDING_SAMPLE_RECOMMENDATION] : recommendations
          }
          recommendState={isOnboardingVisible ? 'ready' : recommendState}
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

      {/* 나침반 버튼. 현재 위치 버튼 바로 위에서 시트를 따라 움직이고, 지도를 돌리거나 기울였을 때만 보이고 누를 수 있음 */}
      {containerHeight > 0 && (
        <Animated.View
          pointerEvents={isCompassVisible && !isSheetExpanded ? 'box-none' : 'none'}
          accessibilityElementsHidden={!isCompassVisible || isSheetExpanded}
          importantForAccessibility={
            isCompassVisible && !isSheetExpanded ? 'auto' : 'no-hide-descendants'
          }
          style={[{ position: 'absolute', right: 16 }, compassButtonStyle]}
        >
          <CompassButton bearing={mapBearing} onPress={resetHeading} />
        </Animated.View>
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
        {/* 첫 방문 안내가 검색창 칸을 짚을 수 있게 이름을 붙여 둠 */}
        <View ref={tourTargetRef('search-bar')} className="z-10 w-full">
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
      {/* 처음 들어왔거나, 더보기의 "사용법 다시 보기"로 왔으면(?showOnboarding=1) 안내를 띄움 */}
      {isOnboardingVisible && <OnboardingTour steps={tourSteps} onClose={closeOnboarding} />}
      {/* 새 버전 안내는 사용법 안내가 완전히 닫힌 뒤에 띄워 두 창이 겹치지 않게 함 */}
      {updateNotice && isUpdateNoticeReady && (
        <UpdateNoticeModal
          notice={updateNotice}
          currentVersion={currentVersion}
          onDismiss={dismissUpdate}
          onUpdate={openStore}
        />
      )}
    </View>
  )
}
