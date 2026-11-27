import type { AdminCharger, AdminRegion, CollectionTargetName } from '@/types/admin'

export const ADMIN_REGION_LABEL: Record<AdminRegion, string> = {
  all: '전체',
  seoul: '도심',
  city: '마포구',
  service_area: '휴게소',
}

/** 화면에서 고르는 지역 (전체 · 도심 · 휴게소). 도심은 서울 전체(seoul)로 요청 — 마포구(city)는 구 선택으로 고름 */
export type AdminRegionChoice = Exclude<AdminRegion, 'city'>

/** 운영자 화면이 처음 보여 주는 지역 — 미리 불러오기(prefetchAdminPage)도 이 값으로 요청 */
export const DEFAULT_ADMIN_REGION: AdminRegionChoice = 'all'

/**
 * 서울 구 코드(충전기 API zscode) → 이름. 백엔드 SEOUL_DISTRICTS(backend/app/schemas/admin.py)와 같아야 함
 * 마포구(11440)만 city 대상, 나머지는 live 대상
 */
export const SEOUL_DISTRICTS: Record<string, string> = {
  '11110': '종로구',
  '11140': '중구',
  '11170': '용산구',
  '11200': '성동구',
  '11215': '광진구',
  '11230': '동대문구',
  '11260': '중랑구',
  '11290': '성북구',
  '11305': '강북구',
  '11320': '도봉구',
  '11350': '노원구',
  '11380': '은평구',
  '11410': '서대문구',
  '11440': '마포구',
  '11470': '양천구',
  '11500': '강서구',
  '11530': '구로구',
  '11545': '금천구',
  '11560': '영등포구',
  '11590': '동작구',
  '11620': '관악구',
  '11650': '서초구',
  '11680': '강남구',
  '11710': '송파구',
  '11740': '강동구',
}

/** 도심 · 휴게소 안의 지역 선택지 ('all'은 전체). 도심은 서울 25개 구를 가나다순으로 */
export const DISTRICT_OPTIONS: Record<
  Exclude<AdminRegionChoice, 'all'>,
  { value: string; label: string }[]
> = {
  seoul: [
    { value: 'all', label: '서울 전체' },
    ...Object.entries(SEOUL_DISTRICTS)
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ko')),
  ],
  // 휴게소는 아직 API에 지역 파라미터가 없어 화면에서만 씀
  service_area: [
    { value: 'all', label: '전체' },
    { value: 'C0', label: '전국 고속도로' },
  ],
}

/** 이용률 · 충전기 목록 요청의 district. 도심에서 구를 골랐을 때만 넘기고, 그 밖에는 빼서 지역 전체를 받음 */
export function toDistrictParam(region: AdminRegion, district: string) {
  // 백엔드가 구를 서울 안에서만 받아서, 다른 지역이나 '전체'면 보내지 않음 (보내면 422)
  if (region !== 'seoul' || district === 'all') return undefined
  return district
}

/** 표의 '구분' 칸 기본 문구 (마포구 · 서울 모두 도심) */
export const CHARGER_REGION_LABEL: Record<CollectionTargetName, string> = {
  city: '도심',
  live: '도심',
  service_area: '휴게소',
}

/** 표의 '구분' 칸 문구. 도심은 구 이름(예: 강남구)을, 구를 모르면 '도심'을 보여 줌 */
export function chargerRegionLabel(charger: Pick<AdminCharger, 'region' | 'districtName'>) {
  // 휴게소는 구가 없어서 늘 '휴게소'
  if (charger.region === 'service_area') return CHARGER_REGION_LABEL.service_area
  return charger.districtName ?? CHARGER_REGION_LABEL[charger.region]
}

/** 데이터 수집 카드 제목 — 서울은 마포구(city)와 나머지 서울(live)을 따로 수집해서 둘을 나눠 부름 */
export const COLLECTION_TARGET_LABEL: Record<CollectionTargetName, string> = {
  city: '마포구',
  live: '서울(마포구 외)',
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
export const ADMIN_REGION_OPTIONS = (['all', 'seoul', 'service_area'] as const).map((value) => ({
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
