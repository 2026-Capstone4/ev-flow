import { DEFAULT_HORIZON } from './constants'
import type {
  ApiHorizonMinutes,
  CurrentCongestion,
  HorizonMinutes,
  Prediction,
  Station,
} from '../types/station'

/** 화면 시점 순서. 0 = 지금 출발 */
export const HORIZONS: HorizonMinutes[] = [0, 15, 30]

/** URL 쿼리 등 외부 값을 예측 시점으로. 잘못된 값이면 기본값 */
export function parseHorizon(value: string | null): HorizonMinutes {
  // Number(null) · Number('')가 0(지금 출발)이 되므로 빈 값은 먼저 기본값으로
  if (!value) return DEFAULT_HORIZON
  const horizon = Number(value)
  return HORIZONS.find((h) => h === horizon) ?? DEFAULT_HORIZON
}

/** 시점 선택 버튼 · 예측 칸 이름 (지금 출발 · 15분 후) */
export function getHorizonLabel(horizon: ApiHorizonMinutes) {
  // 0분은 "0분 후" 대신 출발 시점으로 표시
  if (horizon === 0) return '지금 출발'
  return `${horizon}분 후`
}

/** 문장 앞에 붙이는 시점 (지금 예상 대기 · 15분 후 예상 대기) */
export function getHorizonWhen(horizon: ApiHorizonMinutes) {
  // 0분은 "지금"으로 표시
  if (horizon === 0) return '지금'
  return `${horizon}분 후`
}

/**
 * 현재 혼잡도를 지금(0분) 시점 값으로 바꾼다.
 * 지금은 예측이 아니라 실시간 상태만 보므로 대기시간 · 출처는 null
 */
export function toCurrentPrediction(current: CurrentCongestion): Prediction {
  return {
    horizonMinutes: 0,
    // 지금 상태를 모르거나 운영 불가면 혼잡도 없음(null)
    congestion: current === 'unknown' || current === 'unavailable' ? null : current,
    waitTimeP50Minutes: null,
    waitTimeP90Minutes: null,
    source: null,
  }
}

/** 충전소의 해당 시점 예측을 찾는다. 지금(0분)은 서버 예측 대신 현재 혼잡도 */
export function findPrediction(
  station: Pick<Station, 'congestion' | 'predictions'>,
  horizon: HorizonMinutes,
): Prediction | undefined {
  // 지금 출발은 실시간 상태만 봄
  if (horizon === 0) return toCurrentPrediction(station.congestion)
  return station.predictions.find((p) => p.horizonMinutes === horizon)
}
