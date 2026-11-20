import { NaverMapView, type Region } from '@mj-studio/react-native-naver-map'
import { router, useFocusEffect } from 'expo-router'
import { useMapHomeData } from '@ev-flow/core/hooks/useMapHomeData'
import { useMapView } from '@ev-flow/core/hooks/useMapView'
import { MAPO_CENTER } from '@ev-flow/core/lib/constants'
import { isDotStation, isHiddenZoom, isInView, toViewBounds } from '@ev-flow/core/lib/mapMarkers'
import { countActiveFilters } from '@ev-flow/core/lib/stationFilter'
import type { Station } from '@ev-flow/core/types/station'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FilterPanel } from '../../components/FilterPanel'
import { RecommendSheet } from '../../components/RecommendSheet'
import { SearchBar } from '../../components/SearchBar'
import { UpdateStatus } from '../../components/UpdateStatus'
import { ZoomInNotice } from '../../components/ZoomInNotice'
import { CoverageMask } from '../../map/CoverageMask'
import { StationMarker } from '../../map/StationMarker'
import { toAppZoom, toWebZoomLevel } from '../../map/zoom'

/** 첫 화면 줌 (웹 기준). 웹 지도 홈과 같은 넓이가 보이게 앱 줌으로 바꿔 씀 */
const INITIAL_WEB_ZOOM = 14

/** 상태 표시줄 아래 검색창까지 띄우는 여백 (웹 top-4) */
const TOP_GAP = 16

/**
 * 겹친 마커를 SDK가 숨기게 할지. 서울 전역 색 점이 덜 빽빽해짐 (3단계 확인)
 * 마포 · 추천 숫자 마커는 StationMarker가 빼서 숫자가 사라지지 않음
 */
const IS_HIDE_COLLIDED = true

/** 카메라 상태. webZoomLevel은 core 줌 기준(점 · 숨김)에 넘기는 정수 단계 */
type CameraState = { webZoomLevel: number; region: Region | null }

// 지도 홈 (하단 탭 첫 번째). 데이터는 웹과 같은 core useMapHomeData
// 지금 위치 버튼 · 첫 방문 안내는 5단계, 추천 카드의 길찾기 버튼은 4단계 3번에서 더함
export default function MapHomeScreen() {
  const insets = useSafeAreaInsets()
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

  // 화면 범위에 든 충전소만 마커로 그림. 줌이 너무 작으면 하나도 안 그림
  const visibleStations = useMemo(() => {
    // 처음 카메라 범위를 받기 전이거나 너무 멀리 보면 그리지 않음
    if (!stations || !camera.region || isHiddenZoom(camera.webZoomLevel)) return []
    const { latitude, longitude, latitudeDelta, longitudeDelta } = camera.region
    const view = toViewBounds(
      { lat: latitude, lng: longitude },
      { lat: latitude + latitudeDelta, lng: longitude + longitudeDelta },
    )
    return stations.filter((station) => isInView(station, view))
  }, [stations, camera])
  /** 너무 멀리 봐서 마커를 숨긴 동안 확대 안내를 띄움 */
  const isZoomedOut = camera.region !== null && isHiddenZoom(camera.webZoomLevel)

  // 카메라가 멈췄을 때만 범위를 다시 계산함. 움직이는 동안은 SDK가 그대로 옮겨 그림
  const handleCameraIdle = useCallback(({ zoom, region }: { zoom?: number; region: Region }) => {
    // 줌을 못 받으면 첫 화면 줌으로 둠
    setCamera({
      webZoomLevel: zoom === undefined ? INITIAL_WEB_ZOOM : toWebZoomLevel(zoom),
      region,
    })
  }, [])

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
        style={{ flex: 1 }}
        initialCamera={{
          latitude: MAPO_CENTER.lat,
          longitude: MAPO_CENTER.lng,
          zoom: toAppZoom(INITIAL_WEB_ZOOM),
        }}
        isShowLocationButton={false}
        isShowZoomControls={false}
        onCameraIdle={handleCameraIdle}
      >
        <CoverageMask />
        {visibleStations.map((station) => {
          const isRecommended = recommendedIds.has(station.stationId)
          return (
            <StationMarker
              key={station.stationId}
              station={station}
              isRecommended={isRecommended}
              isDot={isDotStation(camera.webZoomLevel, station, isRecommended)}
              isHideCollided={IS_HIDE_COLLIDED}
              onTap={handleMarkerTap}
            />
          )
        })}
      </NaverMapView>

      {containerHeight > 0 && (
        <RecommendSheet
          recommendations={recommendations}
          recommendState={recommendState}
          retryAfterSeconds={recommendRetryAfterSeconds}
          horizon={horizon}
          onHorizonChange={setHorizon}
          onSelect={openStation}
          containerHeight={containerHeight}
        />
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
        <UpdateStatus updatedAt={updatedAt} isError={isStationsError} />
        {/* 너무 멀리 봐서 마커를 숨긴 동안은 확대하라고 계속 안내. 왼쪽 정렬 줄에서 혼자 가운데로 */}
        {isZoomedOut && (
          <View className="mt-2 self-center">
            <ZoomInNotice />
          </View>
        )}
      </View>
    </View>
  )
}
