import type { StationsResponse } from '@/types/station'

/**
 * 마지막으로 받은 충전소 목록을 브라우저(localStorage)에 남겨 다음 방문 때 마커를 바로 그림.
 * 화면에는 곧바로 새 목록을 받아 바꾸고, 그 사이에는 갱신 시각(UpdateStatus)으로 예전 값인 걸 알 수 있음.
 * 응답 모양을 바꿔 예전 저장값을 못 쓰게 되면 키 끝의 버전을 올림
 */
export const STATIONS_CACHE_KEY = 'evflow:stations:v1'

/** 이보다 오래된 목록은 버림. 너무 예전 대수 · 혼잡도를 잠깐이라도 보여 주면 헷갈림 */
export const STATIONS_CACHE_MAX_AGE_MS = 30 * 60_000

/** 저장해 둔 충전소 목록. 없거나, 깨졌거나, 오래됐으면 undefined */
export function loadStationsCache(now = Date.now(), storage?: Pick<Storage, 'getItem'>) {
  // 저장소가 막힌 브라우저는 localStorage에 손대는 순간 에러가 나서 try 안에서 꺼냄
  try {
    const saved = (storage ?? window.localStorage).getItem(STATIONS_CACHE_KEY)
    // 저장한 적이 없으면 서버 응답을 기다림
    if (!saved) return undefined
    const response: StationsResponse = JSON.parse(saved)
    // 다른 모양의 값이 들어 있으면 쓰지 않음
    if (!Array.isArray(response?.stations) || typeof response.updatedAt !== 'string') {
      return undefined
    }
    const age = now - new Date(response.updatedAt).getTime()
    // 갱신 시각을 못 읽었거나 오래됐으면 쓰지 않음
    if (!(age <= STATIONS_CACHE_MAX_AGE_MS)) return undefined
    return response
  } catch {
    // 시크릿 창 · 저장소 차단 · 깨진 JSON이면 저장값 없이 서버 응답을 기다림
    return undefined
  }
}

/** 받은 충전소 목록을 저장함. 폴링마다 덮어씀 */
export function saveStationsCache(response: StationsResponse, storage?: Pick<Storage, 'setItem'>) {
  try {
    ;(storage ?? window.localStorage).setItem(STATIONS_CACHE_KEY, JSON.stringify(response))
  } catch {
    // 저장 공간이 모자라거나 막혀 있으면 다음 방문에 서버 응답을 기다릴 뿐이라 그냥 넘어감
  }
}
