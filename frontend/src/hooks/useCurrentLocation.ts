import { useCallback, useState } from 'react'
import { useMapView } from '@ev-flow/core/hooks/useMapView'
import { isInMapo } from '@ev-flow/core/lib/coverage'
import { isLocateFailure, toLocateFailure, type LocateFailure } from '@ev-flow/core/lib/geolocation'
import type { LatLng } from '@ev-flow/core/types/geo'

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
 * 기기 위치를 한 번 재서 그대로 돌려줌. 추천 기준 위치는 바꾸지 않고, 마포구 밖이어도 돌려줌
 * 상태 이상 충전기 화면이 처음 보여 줄 구를 정할 때 씀. HTTP 주소 · 권한 거부 · 시간 초과 등은 모두 null
 */
export async function readDeviceLocation(): Promise<LatLng | null> {
  // HTTP 주소이거나 위치 API가 없는 브라우저면 재지 않음
  if (!window.isSecureContext || !('geolocation' in navigator)) return null
  try {
    return await readPosition()
  } catch {
    // 권한 거부 · 시간 초과 등은 위치 없이 진행 (기본 구를 그대로 씀)
    return null
  }
}

/**
 * 현재 위치를 한 번 재서, 마포구 안이면 사용자 위치(검색 거리 · 길찾기 출발지)로 바꿈.
 * 추천은 바로 부르지 않고 기준점 규칙(500m · 2분 · 5분, core useRecommendationOrigin)대로 부름
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
    } catch (error) {
      // 위치 측정 실패면 그 이유를, 예상 못 한 오류면 위치를 못 찾은 것으로 안내
      return { ok: false, reason: isLocateFailure(error) ? error : 'unavailable' }
    } finally {
      setIsLocating(false)
    }
  }, [setUserLocation])

  return { locate, isLocating }
}
