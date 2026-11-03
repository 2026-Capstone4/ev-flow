import { DEFAULT_HORIZON } from '@/lib/constants'
import type { HorizonMinutes } from '@/types/station'

export const HORIZONS: HorizonMinutes[] = [15, 30, 60]

/** URL 쿼리 등 외부 값을 예측 시점으로. 잘못된 값이면 기본값 */
export function parseHorizon(value: string | null): HorizonMinutes {
  const horizon = Number(value)
  return HORIZONS.find((h) => h === horizon) ?? DEFAULT_HORIZON
}
