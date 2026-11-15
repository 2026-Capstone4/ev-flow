import type { MissingBucket, UtilizationBucket } from '@/types/admin'

/** 이용률 막대 색 기준 (빨강 80% 이상 · 주황 60% 이상) */
export const OCCUPANCY_HIGH = 0.8
export const OCCUPANCY_MEDIUM = 0.6

export type OccupancyLevel = 'low' | 'medium' | 'high'

/** 이용률을 막대 색 단계로 바꿈. 관측이 없으면 null */
export function getOccupancyLevel(rate: number | null): OccupancyLevel | null {
  // 관측이 없는 칸(아직 오지 않은 시간 등)은 색을 정하지 않음
  if (rate === null) return null
  // 80% 이상이면 빨강
  if (rate >= OCCUPANCY_HIGH) return 'high'
  // 60% 이상이면 주황, 그 아래는 파랑
  return rate >= OCCUPANCY_MEDIUM ? 'medium' : 'low'
}

/** 결측률 막대를 경고색으로 칠하는 기준. TODO(fe): 팀 기준 정해지면 맞춤 (지금은 임시 3%) */
export const MISSING_WARNING_RATE = 0.03

/** 차트 한 칸 (RateBarChart의 RateDatum과 같은 모양) */
type RateRow = { label: string; rate: number | null; detail: string }

/** 이용률 응답 → 차트 데이터. 툴팁에 표본 수를 보여 줘서 관측이 적은 칸을 구분 */
export function toUtilizationRows(series: UtilizationBucket[]): RateRow[] {
  return series.map((s) => ({
    label: s.label,
    rate: s.occupancyRate,
    detail: `관측 ${s.observationCount.toLocaleString('ko-KR')}건`,
  }))
}

/** 결측 응답 → 차트 데이터 */
export function toMissingRows(series: MissingBucket[]): RateRow[] {
  return series.map((s) => ({
    label: s.label,
    rate: s.missingRate,
    detail: `결측 ${s.missingCount.toLocaleString('ko-KR')} / ${s.expectedCount.toLocaleString('ko-KR')}건 · 실패 실행 ${s.failedRuns}회`,
  }))
}

/** 집계 기간 문구 (예: 10/24 ~ 10/30). 같은 날이면 날짜 하나만 */
export function formatPeriodRange(from: string, to: string) {
  const format = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`
  // 서버는 +09:00 시각을 보내서 앞 10글자가 KST 날짜
  return from.slice(0, 10) === to.slice(0, 10) ? format(from) : `${format(from)} ~ ${format(to)}`
}
