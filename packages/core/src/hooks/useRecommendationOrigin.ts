import { focusManager, onlineManager } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useScreenActive } from '../app/screenActive'
import { useMapView } from './useMapView'
import {
  RECOMMEND_INTERVAL_MS,
  RECOMMEND_MIN_INTERVAL_MS,
  RECOMMEND_MOVE_THRESHOLD_M,
} from '../lib/constants'
import { getDistanceMeters } from '../lib/distance'
import type { LatLng } from '../types/geo'

/** 지금 추천을 다시 부를지. 안 부르면 언제 다시 볼지(ms) */
export type RecommendStep = { call: true } | { call: false; checkInMs: number | null }

/**
 * 추천을 다시 부를 때인지 정함 (2026-11-22 결정)
 * - 마지막 추천에서 5분 지났으면 부름 (5분 주기 · 다른 화면 · 백그라운드에서 돌아온 경우 모두)
 * - 기준점에서 500m 넘게 벗어났으면, 마지막 추천에서 2분 지났을 때 부름. 2분 전이면 2분이 될 때 다시 봄
 * - 아직 한 번도 안 불렀으면(null) 쿼리가 처음 열 때 스스로 부르므로 여기서는 부르지 않음
 */
export function getRecommendStep(
  now: number,
  lastCallAt: number | null,
  origin: LatLng,
  location: LatLng,
): RecommendStep {
  // 처음 열 때는 쿼리가 알아서 부름
  if (lastCallAt === null) return { call: false, checkInMs: null }
  const elapsed = now - lastCallAt
  // 5분이 지났으면 위치와 상관없이 부름
  if (elapsed >= RECOMMEND_INTERVAL_MS) return { call: true }
  const moved = getDistanceMeters(origin, location) > RECOMMEND_MOVE_THRESHOLD_M
  // 500m 넘게 움직였으면 2분이 지났을 때 부르고, 아직이면 2분이 되는 때 다시 봄
  if (moved) {
    if (elapsed >= RECOMMEND_MIN_INTERVAL_MS) return { call: true }
    return { call: false, checkInMs: RECOMMEND_MIN_INTERVAL_MS - elapsed }
  }
  return { call: false, checkInMs: RECOMMEND_INTERVAL_MS - elapsed }
}

/**
 * 추천 기준점을 지금 위치로 옮기거나 같은 자리에서 다시 부름. 지도 홈 화면에서만 씀
 * 화면이 가려졌거나 앱(웹은 탭)이 백그라운드 · 오프라인이면 멈추고, 돌아오면 바로 다시 판단함
 * refetch: 기준점이 지금 위치와 같아 쿼리 키가 안 바뀔 때 부를 함수
 */
export function useRecommendationOrigin(refetch: () => void) {
  const { userLocation, recommendOrigin, setRecommendOrigin, lastRecommendAt } = useMapView()
  const isScreenActive = useScreenActive()
  // 타이머 · 포커스 · 연결 상태가 바뀔 때 다시 판단하게 하는 값
  const [checkCount, setCheckCount] = useState(0)

  // 앱이 앞으로 오거나(웹은 탭이 보이거나) 네트워크가 다시 연결되면 다시 판단
  useEffect(() => {
    const recheck = () => setCheckCount((n) => n + 1)
    const unsubscribeFocus = focusManager.subscribe(recheck)
    const unsubscribeOnline = onlineManager.subscribe(recheck)
    return () => {
      unsubscribeFocus()
      unsubscribeOnline()
    }
  }, [])

  useEffect(() => {
    // 안 보이는 동안은 부르지 않음. 돌아오면 위 구독이나 화면 활성 값이 바뀌어 다시 판단함
    if (!isScreenActive || !focusManager.isFocused() || !onlineManager.isOnline()) return
    const step = getRecommendStep(Date.now(), lastRecommendAt, recommendOrigin, userLocation)
    if (step.call) {
      const isSamePlace =
        userLocation.lat === recommendOrigin.lat && userLocation.lng === recommendOrigin.lng
      // 위치가 그대로면 키가 같아 기준점을 바꿔도 안 불리므로 직접 다시 부름
      if (isSamePlace) refetch()
      else setRecommendOrigin(userLocation)
      return
    }
    // 다시 볼 때가 없으면 타이머를 걸지 않음
    if (step.checkInMs === null) return
    const timer = setTimeout(() => setCheckCount((n) => n + 1), step.checkInMs)
    return () => clearTimeout(timer)
  }, [
    isScreenActive,
    lastRecommendAt,
    recommendOrigin,
    userLocation,
    checkCount,
    refetch,
    setRecommendOrigin,
  ])

  return recommendOrigin
}
