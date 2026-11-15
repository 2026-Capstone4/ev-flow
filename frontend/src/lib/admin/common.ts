import type { AdminRegion } from '@/types/admin'

export const ADMIN_REGION_LABEL: Record<AdminRegion, string> = {
  all: '전체',
  city: '도심',
  service_area: '휴게소',
}

/** 도심 · 휴게소 안의 지역 선택지. value는 수집 대상 zscode ('all'은 전체). 아직 API에 지역 파라미터가 없어 화면에서만 씀 */
export const DISTRICT_OPTIONS: Record<
  Exclude<AdminRegion, 'all'>,
  { value: string; label: string }[]
> = {
  city: [
    { value: 'all', label: '전체' },
    { value: '11440', label: '마포구' },
  ],
  service_area: [
    { value: 'all', label: '전체' },
    { value: '44130', label: '천안' },
  ],
}

/** 표의 '구분' 칸 문구 */
export const CHARGER_REGION_LABEL: Record<Exclude<AdminRegion, 'all'>, string> = {
  city: '도심',
  service_area: '휴게소',
}

/** 마지막 수집 성공 후 이 시간이 지나면 끊긴 것으로 봄 (docs/api/README.md 충전기 상태 20분 규칙) */
export const STALE_AFTER_MS = 20 * 60_000

/** 0~1 비율을 퍼센트 문구로 (예: 0.072 → 7%). 값이 없으면 '—' */
export function formatPercent(rate: number | null, digits = 0) {
  // 관측이 없으면 0%와 구분되게 대시로 표시
  if (rate === null) return '—'
  return `${(rate * 100).toFixed(digits)}%`
}

/** 상태 갱신 시각이 기준 시각보다 20분 넘게 오래됐는지. 시각이 없으면 오래된 것으로 봄 */
export function isStale(at: string | null, reference: Date) {
  // 수신 기록 자체가 없으면 운영자가 확인해야 하므로 오래된 것과 같게 표시
  if (!at) return true
  return reference.getTime() - new Date(at).getTime() > STALE_AFTER_MS
}
