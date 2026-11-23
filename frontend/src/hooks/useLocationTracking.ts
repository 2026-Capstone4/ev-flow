import { useCallback, useEffect, useState } from 'react'
import { useMapView } from '@ev-flow/core/hooks/useMapView'
import { isInMapo } from '@ev-flow/core/lib/coverage'

/** 정확도보다 배터리 · 응답 속도 우선. 추천은 500m 기준이라 충분함 */
const WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: false, maximumAge: 30_000 }

/**
 * 탭이 열려 있는 동안 위치를 따라가며 사용자 위치(userLocation)를 바꿈 (2026-11-22 결정)
 * 권한 창은 띄우지 않음. 이미 허용돼 있거나, 현재 위치 버튼으로 처음 허용한 뒤(recheck)부터 따라감
 * 마포구 밖 위치는 추천을 못 하므로 버리고 마지막 마포구 안 위치를 그대로 둠
 */
export function useLocationTracking(enabled: boolean) {
  const { setUserLocation } = useMapView()
  const [isPermitted, setIsPermitted] = useState(false)

  const isSupported = enabled && window.isSecureContext && 'geolocation' in navigator

  // 처음 열 때 이미 허용돼 있는지 봄. 권한 API가 없는 브라우저는 버튼으로 위치를 받을 때까지 기다림
  useEffect(() => {
    // 위치 기능이 꺼진 빌드 · HTTP 주소 · 위치 API가 없는 브라우저는 따라가지 않음
    if (!isSupported) return
    let isCancelled = false
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        // 확인하는 사이 화면이 사라졌으면 바꾸지 않음
        if (!isCancelled) setIsPermitted(status.state === 'granted')
      })
      .catch(() => {})
    return () => {
      isCancelled = true
    }
  }, [isSupported])

  /** 현재 위치 버튼으로 위치를 받았으면(허용됨) 그때부터 따라감 */
  const recheck = useCallback(
    (isGranted: boolean) => {
      // 지원하는 환경에서 허용됐을 때만 시작
      if (isSupported && isGranted) setIsPermitted(true)
    },
    [isSupported],
  )

  useEffect(() => {
    // 권한이 없으면 따라가지 않음
    if (!isPermitted) return
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude }
        // 마포구 밖이면 기준 위치를 바꾸지 않음 (현재 위치 버튼과 같은 규칙)
        if (isInMapo(location)) setUserLocation(location)
      },
      () => {
        // 잠깐 위치를 못 받는 것은 무시하고 마지막 위치를 그대로 둠
      },
      WATCH_OPTIONS,
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [isPermitted, setUserLocation])

  return { recheck }
}
