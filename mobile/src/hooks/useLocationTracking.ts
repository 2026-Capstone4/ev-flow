import * as Location from 'expo-location'
import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { useMapView } from '@ev-flow/core/hooks/useMapView'
import { isInMapo } from '@ev-flow/core/lib/coverage'

/** 50m 넘게 움직일 때만 새 위치를 받음. 추천은 500m 기준이라 이 정도면 충분함 */
const DISTANCE_INTERVAL_M = 50

/**
 * 앱이 켜져 있는 동안 위치를 따라가며 사용자 위치(userLocation)를 바꿈 (2026-11-22 결정)
 * 권한 창은 띄우지 않음. 이미 허용돼 있거나, 현재 위치 버튼으로 처음 허용한 뒤(recheck)부터 따라감
 * 백그라운드 권한은 쓰지 않음 - 앱이 뒤로 가면 iOS가 위치를 보내지 않음
 * 마포구 밖 위치는 추천을 못 하므로 버리고 마지막 마포구 안 위치를 그대로 둠
 */
export function useLocationTracking(enabled: boolean) {
  const { setUserLocation } = useMapView()
  const [isPermitted, setIsPermitted] = useState(false)

  /** 지금 위치 권한이 있는지 다시 봄. 창은 띄우지 않음 */
  const recheck = useCallback(() => {
    // 위치 기능이 꺼진 빌드(시연 고정 좌표)는 따라가지 않음
    if (!enabled) return
    Location.getForegroundPermissionsAsync()
      .then(({ granted }) => setIsPermitted(granted))
      .catch(() => setIsPermitted(false))
  }, [enabled])

  // 처음 열 때 한 번, 그리고 설정 앱에서 권한을 바꾸고 돌아올 때 다시 봄
  useEffect(() => {
    // 위치 기능이 꺼진 빌드는 볼 것이 없음
    if (!enabled) return
    let isCancelled = false
    const check = () =>
      Location.getForegroundPermissionsAsync()
        .then(({ granted }) => {
          // 확인하는 사이 화면이 사라졌으면 바꾸지 않음
          if (!isCancelled) setIsPermitted(granted)
        })
        .catch(() => {})
    check()
    const subscription = AppState.addEventListener('change', (status) => {
      // 앱이 다시 앞으로 왔을 때만 봄
      if (status === 'active') check()
    })
    return () => {
      isCancelled = true
      subscription.remove()
    }
  }, [enabled])

  useEffect(() => {
    // 권한이 없으면 따라가지 않음
    if (!enabled || !isPermitted) return
    let subscription: Location.LocationSubscription | null = null
    let isCancelled = false
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: DISTANCE_INTERVAL_M },
      (position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude }
        // 마포구 밖이면 기준 위치를 바꾸지 않음 (현재 위치 버튼과 같은 규칙)
        if (isInMapo(location)) setUserLocation(location)
      },
    )
      .then((sub) => {
        // 시작하는 사이 화면이 사라졌으면 바로 멈춤
        if (isCancelled) sub.remove()
        else subscription = sub
      })
      .catch(() => {
        // 위치 서비스가 꺼져 있는 등으로 시작 못 하면 버튼으로만 위치를 잼
      })
    return () => {
      isCancelled = true
      subscription?.remove()
    }
  }, [enabled, isPermitted, setUserLocation])

  return { recheck }
}
