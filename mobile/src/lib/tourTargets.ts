import type { ComponentRef } from 'react'
import type { View } from 'react-native'

/** 화면에 그려진 View. measureInWindow로 위치를 잴 수 있음 */
export type ViewInstance = ComponentRef<typeof View>

/** 화면에서 짚을 칸. 창(window) 기준 좌표 */
export type TourRect = { x: number; y: number; width: number; height: number }

/** 첫 방문 안내가 짚는 칸 이름. 하단 탭처럼 지도 홈 밖에 있는 요소도 이 이름으로 찾음 */
export type TourTargetId = 'search-bar' | 'service-areas-tab'

/** 이름별로 붙여 둔 View. 화면에서 빠지면 지움 */
const targets = new Map<TourTargetId, ViewInstance>()

/** 이름별로 만들어 둔 ref 함수. 같은 이름에는 늘 같은 함수를 돌려줌 */
const refCallbacks = new Map<TourTargetId, (view: ViewInstance | null) => void>()

/**
 * 짚을 요소에 ref로 붙이는 함수를 만듦. <View ref={tourTargetRef('search-bar')}>처럼 씀
 * 이름마다 같은 함수를 돌려줘서 다시 그릴 때마다 ref가 떼었다 붙지 않게 함
 */
export function tourTargetRef(id: TourTargetId) {
  const saved = refCallbacks.get(id)
  // 이미 만든 함수가 있으면 그대로 씀
  if (saved) return saved
  const callback = (view: ViewInstance | null) => {
    // 화면에서 빠지면 기록을 지워서 없는 요소를 재지 않게 함
    if (view) targets.set(id, view)
    else targets.delete(id)
  }
  refCallbacks.set(id, callback)
  return callback
}

/** 붙여 둔 요소의 창 기준 위치 · 크기를 잼. 없거나 아직 그려지지 않았으면 null */
export function measureTourTarget(id: TourTargetId): Promise<TourRect | null> {
  const view = targets.get(id)
  // 붙은 요소가 없으면 잴 것도 없음
  if (!view) return Promise.resolve(null)
  return new Promise((resolve) => {
    view.measureInWindow((x, y, width, height) => {
      // 크기가 0이면 아직 그려지지 않은 것으로 봄
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null)
    })
  })
}
