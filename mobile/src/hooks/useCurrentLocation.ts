import * as Location from 'expo-location'
import { useCallback, useState } from 'react'
import { useMapView } from '@ev-flow/core/hooks/useMapView'
import { isInMapo } from '@ev-flow/core/lib/coverage'
import {
  isLocateFailure,
  LOCATE_FAILURE_MESSAGE,
  type LocateFailure,
} from '@ev-flow/core/lib/geolocation'
import type { LatLng } from '@ev-flow/core/types/geo'

/** 앱에서 생길 수 있는 실패 이유. 'insecure'(HTTP 주소)는 브라우저에만 있는 경우라 뺌 */
export type AppLocateFailure = Exclude<LocateFailure, 'insecure'>

/**
 * 앱 안내 문구. 웹 core 문구를 그대로 쓰고, 브라우저를 가리키는 두 문구만 앱에 맞게 바꿈
 * unsupported는 앱에서 기기 위치 서비스가 꺼진 경우에 씀
 */
export const APP_LOCATE_FAILURE_MESSAGE: Record<AppLocateFailure, string> = {
  unsupported: '기기의 위치 서비스가 꺼져 있어요. 설정 앱에서 켜 주세요',
  denied: '위치 권한이 꺼져 있어요. 설정 앱에서 EV-flow의 위치 접근을 허용해 주세요',
  unavailable: LOCATE_FAILURE_MESSAGE.unavailable,
  timeout: LOCATE_FAILURE_MESSAGE.timeout,
  'out-of-area': LOCATE_FAILURE_MESSAGE['out-of-area'],
}

/** 웹 POSITION_OPTIONS와 같은 기준. 10초 넘으면 포기, 30초 안에 잰 위치는 다시 재지 않고 씀 */
const TIMEOUT_MS = 10_000
const MAX_AGE_MS = 30_000

export type LocateResult = { ok: true; location: LatLng } | { ok: false; reason: AppLocateFailure }

// 30초 안에 잰 위치가 있으면 그걸 쓰고, 없으면 정확도 우선으로 새로 잼
// expo-location에는 시간 제한 옵션이 없어서 10초 타이머와 경주시켜 늦으면 'timeout'으로 reject
async function readPosition() {
  const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: MAX_AGE_MS })
  // 최근에 잰 위치가 있으면 GPS를 다시 켜지 않고 씀
  if (lastKnown) return { lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude }

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject('timeout' satisfies AppLocateFailure), TIMEOUT_MS)
  })
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      timeout,
    ])
    return { lat: position.coords.latitude, lng: position.coords.longitude }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 현재 위치를 한 번 재서, 마포구 안이면 추천 · 검색 · 길찾기 기준 위치로 바꿈 (웹 useCurrentLocation과 같은 흐름)
 * 버튼을 누를 때만 재므로 앱을 열자마자 권한 창이 뜨지 않음
 */
export function useCurrentLocation() {
  const { setUserLocation } = useMapView()
  const [isLocating, setIsLocating] = useState(false)

  const locate = useCallback(async (): Promise<LocateResult> => {
    setIsLocating(true)
    try {
      // 기기 설정에서 위치 서비스를 통째로 끈 경우. 권한을 물어도 소용없어서 먼저 확인함
      if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: 'unsupported' }
      // 처음이면 iOS 권한 창을 띄우고, 이미 정했으면 창 없이 그 결과를 바로 돌려받음
      const { granted } = await Location.requestForegroundPermissionsAsync()
      // 거부했으면 다시 물을 수 없어서 설정 앱 안내를 띄움
      if (!granted) return { ok: false, reason: 'denied' }

      const location = await readPosition()
      // 마포구 밖은 추천을 못 하므로 기준 위치를 바꾸지 않음
      if (!isInMapo(location)) return { ok: false, reason: 'out-of-area' }
      setUserLocation(location)
      return { ok: true, location }
    } catch (error) {
      // 시간 초과면 그 이유를, 위치 신호 없음 · 예상 못 한 오류면 위치를 못 찾은 것으로 안내
      return {
        ok: false,
        reason: isLocateFailure(error) && error !== 'insecure' ? error : 'unavailable',
      }
    } finally {
      setIsLocating(false)
    }
  }, [setUserLocation])

  return { locate, isLocating }
}
