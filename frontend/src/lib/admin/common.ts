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
    { value: 'C0', label: '전국 고속도로' },
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

/** 운영자 화면 지역 전환 선택지 (전체 · 도심 · 휴게소) */
export const ADMIN_REGION_OPTIONS = (['all', 'city', 'service_area'] as const).map((value) => ({
  value,
  label: ADMIN_REGION_LABEL[value],
}))

/**
 * 표 '상태 갱신(운영사)' 칸 안내. statUpdatedAt은 우리가 수집한 시각이 아니라 운영사가 보내는 statUpdDt라
 * 수집이 잘 되고 있어도 몇 시간 · 며칠 전일 수 있음 (운영사마다 기준이 다름)
 */
export const STAT_UPDATED_NOTE =
  '상태 갱신(운영사)은 운영사가 보내는 시각이라 참고용이에요. 우리가 수집한 시각과는 달라요.'

/** 상태 갱신 시각 문구. 기준 시각과 날짜가 다르면 날짜를 앞에 붙임 (예: 11/20 14:05) */
export function formatStatUpdated(at: Date, reference: Date) {
  const clock = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  // 같은 날이면 시각만
  if (at.toDateString() === reference.toDateString()) return clock
  return `${at.getMonth() + 1}/${at.getDate()} ${clock}`
}
