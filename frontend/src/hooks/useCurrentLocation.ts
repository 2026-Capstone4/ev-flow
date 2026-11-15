import { useCallback, useState } from 'react'
import { useMapView } from '@/hooks/useMapView'
import { isInMapo } from '@/lib/coverage'
import { toLocateFailure, type LocateFailure } from '@/lib/geolocation'
import type { LatLng } from '@/types/geo'

/** 정확도 우선, 10초 넘으면 포기, 30초 안에 잰 위치는 다시 재지 않고 씀 */
const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 30_000,
}

export type LocateResult = { ok: true; location: LatLng } | { ok: false; reason: LocateFailure }

// 브라우저 위치 API(콜백 방식)를 await로 쓸 수 있게 감쌈. 실패하면 실패 이유로 reject
function readPosition() {
  return new Promise<LatLng>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => reject(toLocateFailure(error.code)),
      POSITION_OPTIONS,
    )
  })
}

/**
 * 현재 위치를 한 번 재서, 마포구 안이면 추천 · 검색 · 길찾기 기준 위치로 바꿈.
 * 버튼을 누를 때만 재므로 화면을 열자마자 권한 창이 뜨지 않음
 */
export function useCurrentLocation() {
  const { setUserLocation } = useMapView()
  const [isLocating, setIsLocating] = useState(false)

  const locate = useCallback(async (): Promise<LocateResult> => {
    // HTTP 주소에서는 브라우저가 위치를 아예 주지 않음 (localhost는 예외)
    if (!window.isSecureContext) return { ok: false, reason: 'insecure' }
    // 아주 오래된 브라우저 등 위치 API가 없는 경우
    if (!('geolocation' in navigator)) return { ok: false, reason: 'unsupported' }

    setIsLocating(true)
    try {
      const location = await readPosition()
      // 마포구 밖은 추천을 못 하므로 기준 위치를 바꾸지 않음
      if (!isInMapo(location)) return { ok: false, reason: 'out-of-area' }
      setUserLocation(location)
      return { ok: true, location }
    } catch (reason) {
      return { ok: false, reason: reason as LocateFailure }
    } finally {
      setIsLocating(false)
    }
  }, [setUserLocation])

  return { locate, isLocating }
}
