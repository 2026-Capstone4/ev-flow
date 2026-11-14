import { CHARGER_STATUS_LABEL } from '@/lib/charger'
import type {
  AdminCharger,
  AdminRegion,
  CollectionTarget,
  MissingBucket,
  UtilizationBucket,
} from '@/types/admin'
import type { ChargerStatus } from '@/types/station'

export const ADMIN_REGION_LABEL: Record<AdminRegion, string> = {
  all: '전체',
  city: '마포구',
  service_area: '휴게소',
}

/** 표의 '구분' 칸 문구 */
export const CHARGER_REGION_LABEL: Record<Exclude<AdminRegion, 'all'>, string> = {
  city: '도심',
  service_area: '휴게소',
}

/** 마지막 수집 성공 후 이 시간이 지나면 끊긴 것으로 봄 (docs/api/README.md 충전기 상태 20분 규칙) */
export const STALE_AFTER_MS = 20 * 60_000

/** 이용률 막대 색 기준 (Figma 09 대시보드 범례: 빨강 80%+ · 주황 55%+) */
export const OCCUPANCY_HIGH = 0.8
export const OCCUPANCY_MEDIUM = 0.55

export type OccupancyLevel = 'low' | 'medium' | 'high'

/** 이용률을 막대 색 단계로 바꿈. 관측이 없으면 null */
export function getOccupancyLevel(rate: number | null): OccupancyLevel | null {
  // 관측이 없는 칸(아직 오지 않은 시간 등)은 색을 정하지 않음
  if (rate === null) return null
  // 80% 이상이면 빨강
  if (rate >= OCCUPANCY_HIGH) return 'high'
  // 55% 이상이면 주황, 그 아래는 파랑
  return rate >= OCCUPANCY_MEDIUM ? 'medium' : 'low'
}

/** 0~1 비율을 퍼센트 문구로 (예: 0.072 → 7%). 값이 없으면 '—' */
export function formatPercent(rate: number | null, digits = 0) {
  // 관측이 없으면 0%와 구분되게 대시로 표시
  if (rate === null) return '—'
  return `${(rate * 100).toFixed(digits)}%`
}

/** 충전기 상태 문구. 확인 불가는 원본 코드로 통신 이상 · 상태 미확인을 나눠 보여 줌 */
export function getAdminChargerStatusLabel(charger: Pick<AdminCharger, 'status' | 'stat'>) {
  // 확인 불가가 아니면 사용자 화면과 같은 문구
  if (charger.status !== 'unknown') return CHARGER_STATUS_LABEL[charger.status]
  // 원본 코드 1 = 통신이상 → 운영자가 바로 조치할 대상이라 따로 표시
  if (charger.stat === '1') return '통신 이상'
  // 원본 코드 9 = 상태미확인
  if (charger.stat === '9') return '상태 미확인'
  // 0 등 그 밖의 코드, 또는 20분 넘게 수집이 끊겨 확인 불가가 된 경우
  return CHARGER_STATUS_LABEL.unknown
}

export type ChargerSummary = {
  total: number
  cityCount: number
  serviceAreaCount: number
  /** 운영 중지 + 점검 중 */
  faultCount: number
  cityFaultCount: number
  serviceAreaFaultCount: number
  unknownCount: number
  /** 지금 충전 중 ÷ (사용 가능 + 충전 중). 둘 다 0이면 null */
  currentOccupancyRate: number | null
}

/** 요약 카드용 집계. 이용률 분모는 API 명세와 같이 운영 중지 · 점검 · 확인 불가를 뺌 */
export function summarizeChargers(chargers: AdminCharger[]): ChargerSummary {
  const isFault = (c: AdminCharger) => c.status === 'stopped' || c.status === 'maintenance'
  const count = (predicate: (c: AdminCharger) => boolean) => chargers.filter(predicate).length

  const charging = count((c) => c.status === 'charging')
  const usable = charging + count((c) => c.status === 'available')

  return {
    total: chargers.length,
    cityCount: count((c) => c.region === 'city'),
    serviceAreaCount: count((c) => c.region === 'service_area'),
    faultCount: count(isFault),
    cityFaultCount: count((c) => c.region === 'city' && isFault(c)),
    serviceAreaFaultCount: count((c) => c.region === 'service_area' && isFault(c)),
    unknownCount: count((c) => c.status === 'unknown'),
    currentOccupancyRate: usable > 0 ? charging / usable : null,
  }
}

export type ChargerSortKey = 'status' | 'name' | 'occupancy'

/** asc = 상태는 이상 먼저 · 이름은 가나다 · 이용률은 낮은 순 */
export type SortDirection = 'asc' | 'desc'

export type ChargerSort = { key: ChargerSortKey; direction: SortDirection }

export const CHARGER_SORT_LABEL: Record<ChargerSortKey, string> = {
  status: '상태',
  name: '충전소명',
  occupancy: '오늘 이용률',
}

/** 방향 문구 — 칩에 '오늘 이용률 · 높은 순'처럼 붙여 보여 줌 */
export const SORT_DIRECTION_LABEL: Record<ChargerSortKey, Record<SortDirection, string>> = {
  status: { asc: '이상 먼저', desc: '정상 먼저' },
  name: { asc: '가나다순', desc: '가나다 역순' },
  occupancy: { asc: '낮은 순', desc: '높은 순' },
}

/** 기준을 처음 고를 때의 방향 — 운영자가 주로 보는 쪽(이상 충전기 · 많이 쓰는 충전기)을 위로 */
export const DEFAULT_SORT_DIRECTION: Record<ChargerSortKey, SortDirection> = {
  status: 'asc',
  name: 'asc',
  occupancy: 'desc',
}

/** 정렬 칩을 눌렀을 때 다음 정렬. 같은 기준이면 방향만 뒤집고, 다른 기준이면 그 기준의 기본 방향 */
export function toggleChargerSort(current: ChargerSort, key: ChargerSortKey): ChargerSort {
  // 이미 고른 칩을 다시 누르면 오름차순 ↔ 내림차순
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  }
  return { key, direction: DEFAULT_SORT_DIRECTION[key] }
}

/** 상태별 정렬 순서 — 운영자가 먼저 봐야 할 이상 충전기를 위로 */
const STATUS_ORDER: Record<ChargerStatus, number> = {
  unknown: 0,
  stopped: 1,
  maintenance: 2,
  charging: 3,
  available: 4,
}

/** 이름 → 충전기 ID 순. 정렬 기준이 같을 때 순서가 매번 바뀌지 않게 함 */
function compareByName(a: AdminCharger, b: AdminCharger) {
  return (
    a.stationName.localeCompare(b.stationName, 'ko') ||
    a.chargerId.localeCompare(b.chargerId, 'ko', { numeric: true })
  )
}

/**
 * 충전기 표 정렬. 원본 배열은 그대로 두고 새 배열을 돌려줌.
 * 기준 값이 같을 때는 방향과 상관없이 충전소명 가나다순으로 둬서 순서가 흔들리지 않게 함
 */
export function sortChargers(chargers: AdminCharger[], { key, direction }: ChargerSort) {
  const sign = direction === 'asc' ? 1 : -1
  const sorted = [...chargers]
  // 충전소명: 가나다순 또는 그 역순 (충전기 번호까지 함께 뒤집힘)
  if (key === 'name') return sorted.sort((a, b) => sign * compareByName(a, b))
  // 오늘 이용률: 관측이 없는(null) 충전기는 방향과 상관없이 맨 아래
  if (key === 'occupancy') {
    return sorted.sort((a, b) => {
      const rateA = a.todayOccupancyRate
      const rateB = b.todayOccupancyRate
      // 한쪽만 관측이 없으면 그쪽을 뒤로
      if (rateA === null || rateB === null) {
        return (rateA === null ? 1 : 0) - (rateB === null ? 1 : 0) || compareByName(a, b)
      }
      return sign * (rateA - rateB) || compareByName(a, b)
    })
  }
  // 상태: asc = 확인 불가 → 운영 중지 → 점검 중 → 충전 중 → 사용 가능, desc는 그 반대
  return sorted.sort(
    (a, b) => sign * (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || compareByName(a, b),
  )
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

/** 로그인 실패 안내 문구. code는 서버 에러 code, 응답이 없었으면 null */
export function getLoginErrorMessage(code: string | null, retryAfterSeconds: number | null) {
  // 아이디 · 비밀번호 불일치 (401)
  if (code === 'INVALID_CREDENTIALS') return '아이디 또는 비밀번호가 올바르지 않습니다.'
  // 연속 실패로 잠김 (429). Retry-After가 있으면 남은 시간을 분 · 초로 알려 줌
  if (code === 'LOGIN_LOCKED') {
    // 남은 시간을 모르면 시간 없이 안내
    if (retryAfterSeconds === null)
      return '로그인 시도가 많아 잠겼습니다. 잠시 후 다시 시도해 주세요.'
    const wait =
      retryAfterSeconds < 60 ? `${retryAfterSeconds}초` : `${Math.ceil(retryAfterSeconds / 60)}분`
    return `로그인 시도가 많아 잠겼습니다. ${wait} 후 다시 시도해 주세요.`
  }
  // 빈 값 등 요청 형식 오류 (422)
  if (code === 'VALIDATION_ERROR') return '아이디와 비밀번호를 입력해 주세요.'
  // 네트워크 오류 · 서버 오류 등 그 밖의 경우
  return '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

/** 상태 갱신 시각이 기준 시각보다 20분 넘게 오래됐는지. 시각이 없으면 오래된 것으로 봄 */
export function isStale(at: string | null, reference: Date) {
  // 수신 기록 자체가 없으면 운영자가 확인해야 하므로 오래된 것과 같게 표시
  if (!at) return true
  return reference.getTime() - new Date(at).getTime() > STALE_AFTER_MS
}

export type CollectionHealth = 'normal' | 'partial' | 'stopped'

export const COLLECTION_HEALTH_LABEL: Record<CollectionHealth, string> = {
  normal: '정상',
  partial: '일부 실패',
  stopped: '수집 끊김',
}

/** 수집 대상 하나의 상태. 20분 넘게 성공이 없으면 끊김, 마지막 실행이 실패 · 부분 성공이면 일부 실패 */
export function getTargetHealth(target: CollectionTarget, now: Date): CollectionHealth {
  // 마지막 성공이 20분 넘게 지났으면 사용자 화면 충전기가 모두 확인 불가가 되는 상태
  if (isStale(target.lastSuccessAt, now)) return 'stopped'
  // 최근 성공은 있지만 마지막 실행이 실패했거나 일부만 저장된 경우
  if (target.lastStatus === 'failed' || target.lastStatus === 'partial') return 'partial'
  return 'normal'
}

/** 요약 카드용 전체 수집 상태 — 대상 중 가장 나쁜 상태. 대상이 없으면 null */
export function getCollectionHealth(
  targets: CollectionTarget[],
  now: Date,
): CollectionHealth | null {
  // 응답에 수집 대상이 하나도 없으면 판정하지 않음
  if (targets.length === 0) return null
  const healths = targets.map((t) => getTargetHealth(t, now))
  // 하나라도 끊겼으면 끊김
  if (healths.includes('stopped')) return 'stopped'
  // 끊긴 건 없지만 실패가 있으면 일부 실패
  return healths.includes('partial') ? 'partial' : 'normal'
}
