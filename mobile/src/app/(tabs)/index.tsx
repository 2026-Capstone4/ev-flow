import { NaverMapView, type Region } from '@mj-studio/react-native-naver-map'
import { router } from 'expo-router'
import { useStationsQuery } from '@ev-flow/core/hooks/useStationsQuery'
import { MAPO_CENTER } from '@ev-flow/core/lib/constants'
import { isDotStation, isHiddenZoom, isInView, toViewBounds } from '@ev-flow/core/lib/mapMarkers'
import type { Station } from '@ev-flow/core/types/station'
import { useCallback, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StationMarker } from '../../map/StationMarker'
import { toAppZoom, toWebZoom, toWebZoomLevel } from '../../map/zoom'

/** 첫 화면 줌 (웹 기준). 웹 지도 홈과 같은 넓이가 보이게 앱 줌으로 바꿔 씀 */
const INITIAL_WEB_ZOOM = 14

/** 위도 1도의 거리(km). 화면 가로 길이 표시에 씀 */
const KM_PER_DEGREE = 111.32

/**
 * 카메라 상태. webZoom은 화면 표시용 웹 줌(소수), webZoomLevel은 core 줌 기준(점 · 숨김)에 넘기는 정수 단계
 */
type CameraState = { webZoom: number; webZoomLevel: number; region: Region | null }

/** 화면 가로 길이(km). 줌 기준을 웹과 비교할 때 봄 */
function toWidthKm(region: Region) {
  return region.longitudeDelta * KM_PER_DEGREE * Math.cos((region.latitude * Math.PI) / 180)
}

// 3단계 지도 검증 화면. 네이티브 SDK 마커로 서울 전역 충전소를 그려 버벅임 · 줌 기준을 확인함
// 위쪽 작은 표시는 확인용 (줌 · 그리는 마커 수 · 겹침 숨김 토글). 4단계에서 지도 홈으로 바꿀 때 뺌
export default function MapCheckScreen() {
  const stationsQuery = useStationsQuery()
  const [camera, setCamera] = useState<CameraState>({
    webZoom: INITIAL_WEB_ZOOM,
    webZoomLevel: INITIAL_WEB_ZOOM,
    region: null,
  })
  const [isHideCollided, setIsHideCollided] = useState(false)

  // 화면 범위에 여유를 더한 곳의 충전소만 마커로 그림. 줌이 너무 작으면 하나도 안 그림
  const visibleStations = useMemo(() => {
    const stations = stationsQuery.data?.stations ?? []
    // 처음 카메라 범위를 받기 전이거나 너무 멀리 보면 그리지 않음
    if (!camera.region || isHiddenZoom(camera.webZoomLevel)) return []
    const { latitude, longitude, latitudeDelta, longitudeDelta } = camera.region
    const view = toViewBounds(
      { lat: latitude, lng: longitude },
      { lat: latitude + latitudeDelta, lng: longitude + longitudeDelta },
    )
    return stations.filter((station) => isInView(station, view))
  }, [stationsQuery.data, camera])

  // 카메라가 멈췄을 때만 범위를 다시 계산함. 움직이는 동안은 SDK가 그대로 옮겨 그림
  const handleCameraIdle = useCallback(({ zoom, region }: { zoom?: number; region: Region }) => {
    // 줌을 못 받으면 첫 화면 줌으로 둠
    if (zoom === undefined) {
      setCamera({ webZoom: INITIAL_WEB_ZOOM, webZoomLevel: INITIAL_WEB_ZOOM, region })
      return
    }
    setCamera({ webZoom: toWebZoom(zoom), webZoomLevel: toWebZoomLevel(zoom), region })
  }, [])

  // 마커를 누르면 충전소 상세로 감. memo 마커가 다시 그려지지 않도록 함수 하나를 계속 씀
  const handleMarkerTap = useCallback(
    (station: Station) =>
      router.push({ pathname: '/stations/[stationId]', params: { stationId: station.stationId } }),
    [],
  )

  return (
    <View className="flex-1 bg-bg-page">
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
        {visibleStations.map((station) => (
          <StationMarker
            key={station.stationId}
            station={station}
            isRecommended={false}
            isDot={isDotStation(camera.webZoomLevel, station, false)}
            isHideCollided={isHideCollided}
            onTap={handleMarkerTap}
          />
        ))}
      </NaverMapView>

      {/* 확인용 표시. 지도 터치를 막지 않게 필요한 곳만 누를 수 있음 */}
      <SafeAreaView pointerEvents="box-none" className="absolute inset-x-0 top-0 px-4">
        <View className="flex-row items-center gap-2 self-start rounded-full bg-white/90 px-3 py-1.5">
          <Text className="font-medium text-xs text-text-primary">
            웹 줌 {camera.webZoom.toFixed(1)}(단계 {camera.webZoomLevel}) · 가로{' '}
            {camera.region ? toWidthKm(camera.region).toFixed(1) : '-'}km · 마커{' '}
            {visibleStations.length.toLocaleString()} / 전체{' '}
            {(stationsQuery.data?.stations.length ?? 0).toLocaleString()}
          </Text>
          <Pressable
            onPress={() => setIsHideCollided((value) => !value)}
            className="rounded-full bg-brand-primary px-2 py-0.5"
          >
            <Text className="font-semibold text-xs text-text-on-brand">
              겹침 숨김 {isHideCollided ? '켬' : '끔'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  )
}
