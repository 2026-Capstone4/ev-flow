import { CHARGER_STATUS_LABEL } from '@ev-flow/core/lib/charger'
import { formatPercent } from '@/lib/admin/common'
import type { AdminCharger } from '@/types/admin'
import type { ChargerStatus } from '@ev-flow/core/types/station'

/** 충전기 상태 문구. 확인 불가는 원본 코드로 통신 이상 · 상태 미확인을 나눠 보여 줌 */
export function getAdminChargerStatusLabel(charger: Pick<AdminCharger, 'status' | 'stat'>) {
  // 확인 불가가 아니면 사용자 화면과 같은 문구
  if (charger.status !== 'unknown') return CHARGER_STATUS_LABEL[charger.status]
  // 원본 코드 1 = 통신이상 → 운영자가 바로 조치할 대상이라 따로 표시
  if (charger.stat === '1') return '통신 이상'
  // 원본 코드 9 = 상태미확인
  if (charger.stat === '9') return '상태 미확인'
  // 0 등 그 밖의 코드, 원본 코드가 없는(null) 경우, 또는 20분 넘게 수집이 끊겨 확인 불가가 된 경우
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

/** 충전소 한 곳의 지금 이용 현황 */
export type StationOccupancy = {
  /** 지금 충전 중인 대수 */
  charging: number
  /** 사용 가능 + 충전 중 대수 (운영 중지 · 점검 · 확인 불가는 뺌) */
  usable: number
  /** charging ÷ usable. usable이 0이면 null */
  rate: number | null
}

/** 충전소별 보기의 한 줄 — 충전기 목록을 충전소로 묶은 결과 */
export type AdminStation = {
  region: AdminCharger['region']
  stationId: string
  stationName: string
  chargerCount: number
  occupancy: StationOccupancy
  /** 운영 중지 + 점검 중 대수 */
  faultCount: number
  /** 확인 불가(통신 이상 · 상태 미확인 등) 대수 */
  unknownCount: number
  /** 충전기들 중 가장 최근 수신 시각. 하나도 없으면 null */
  statUpdatedAt: string | null
}

/**
 * 충전기 목록을 충전소별로 묶음. 현재 이용률은 요약 카드와 같은 계산을 충전소마다 함
 * 충전기 상태가 바뀔 때마다 목록을 다시 받으므로 따로 저장하지 않고 매번 계산
 */
export function groupChargersByStation(chargers: AdminCharger[]): AdminStation[] {
  const stations = new Map<string, AdminStation>()
  for (const charger of chargers) {
    const station = stations.get(charger.stationId) ?? {
      region: charger.region,
      stationId: charger.stationId,
      stationName: charger.stationName,
      chargerCount: 0,
      occupancy: { charging: 0, usable: 0, rate: null },
      faultCount: 0,
      unknownCount: 0,
      statUpdatedAt: null,
    }
    station.chargerCount += 1
    // 충전 중이면 분자 · 분모 둘 다, 사용 가능이면 분모에만 더함
    if (charger.status === 'charging') station.occupancy.charging += 1
    if (charger.status === 'charging' || charger.status === 'available') {
      station.occupancy.usable += 1
    }
    // 운영 중지 · 점검 중은 고장으로 셈
    if (charger.status === 'stopped' || charger.status === 'maintenance') station.faultCount += 1
    if (charger.status === 'unknown') station.unknownCount += 1
    // 더 최근에 받은 시각이면 바꿔 둠 (같은 형식의 ISO 문자열이라 글자 비교로 충분)
    if (
      charger.statUpdatedAt &&
      (!station.statUpdatedAt || charger.statUpdatedAt > station.statUpdatedAt)
    ) {
      station.statUpdatedAt = charger.statUpdatedAt
    }
    stations.set(charger.stationId, station)
  }
  // 대수를 다 센 뒤에 비율 계산
  for (const station of stations.values()) {
    const { charging, usable } = station.occupancy
    station.occupancy.rate = usable > 0 ? charging / usable : null
  }
  return [...stations.values()]
}

/** 현재 이용률 칸 문구 (예: 50% (2/4대)). 쓸 수 있는 충전기가 없으면 '—' */
export function formatStationOccupancy(occupancy: StationOccupancy) {
  // 충전소 전체가 고장 · 점검 · 확인 불가면 비율을 낼 수 없음
  if (occupancy.rate === null) return '—'
  return `${formatPercent(occupancy.rate)} (${occupancy.charging}/${occupancy.usable}대)`
}

/** 충전소별 · 충전기별 보기 전환 */
export type StatusView = 'station' | 'charger'

export const STATUS_VIEW_LABEL: Record<StatusView, string> = {
  station: '충전소별 상태',
  charger: '충전기별 상태',
}

/** 정렬 기준. 현재 이용률은 충전소별 보기에만, 오늘 이용률은 충전기별 보기에만 있음 */
export type SortKey = 'status' | 'name' | 'current' | 'occupancy'
export type StationSortKey = Exclude<SortKey, 'occupancy'>
export type ChargerSortKey = Exclude<SortKey, 'current'>

/** asc = 상태는 이상 먼저 · 이름은 가나다 · 이용률은 낮은 순 */
export type SortDirection = 'asc' | 'desc'

export type Sort<K extends SortKey> = { key: K; direction: SortDirection }
export type StationSort = Sort<StationSortKey>
export type ChargerSort = Sort<ChargerSortKey>

/** 보기마다 보여 줄 정렬 칩 (이 순서대로) */
export const STATION_SORT_KEYS: StationSortKey[] = ['status', 'name', 'current']
export const CHARGER_SORT_KEYS: ChargerSortKey[] = ['status', 'name', 'occupancy']

export const SORT_LABEL: Record<SortKey, string> = {
  status: '상태',
  name: '충전소명',
  current: '현재 이용률',
  occupancy: '오늘 이용률',
}

/** 현재 이용률 설명 — 충전소별 표 머리글 ⓘ 말풍선 */
export const CURRENT_OCCUPANCY_TOOLTIP =
  '충전소에서 지금 충전 중인 충전기의 비율이에요. 운영 중지 · 점검 중 · 상태 확인 불가인 충전기는 대수에서 빼요.'

/** 오늘 이용률 설명 — 충전기별 표 머리글 ⓘ 말풍선 */
export const TODAY_OCCUPANCY_TOOLTIP =
  '오늘 0시부터 지금까지 충전 중이었던 시간의 비율이에요. 운영 중지 · 점검 중 · 상태 확인 불가였던 시간은 빼고 계산해요.'

/** 이용률로 정렬했을 때 패널 위에 띄우는 안내. 상태 · 충전소명 정렬은 안내 없음 */
export const SORT_CAPTION: Partial<Record<SortKey, string>> = {
  current: '충전소별로 지금 충전 중인 충전기의 비율과 대수를 나타내요',
  occupancy: '오늘 0시부터 지금까지 충전 중이었던 시간의 비율을 나타내요',
}

/** 정렬 방향 문구 — 칩에 '오늘 이용률 · 높은 순'처럼 붙여 보여 줌 */
export const SORT_DIRECTION_LABEL: Record<SortKey, Record<SortDirection, string>> = {
  status: { asc: '이상 먼저', desc: '정상 먼저' },
  name: { asc: '가나다순', desc: '가나다 역순' },
  current: { asc: '낮은 순', desc: '높은 순' },
  occupancy: { asc: '낮은 순', desc: '높은 순' },
}

/** 기준을 처음 고를 때의 방향 — 운영자가 주로 보는 쪽(이상 · 많이 쓰는 곳)을 위로 */
export const DEFAULT_SORT_DIRECTION: Record<SortKey, SortDirection> = {
  status: 'asc',
  name: 'asc',
  current: 'desc',
  occupancy: 'desc',
}

/** 정렬 칩을 눌렀을 때 다음 정렬. 같은 기준이면 방향만 뒤집고, 다른 기준이면 그 기준의 기본 방향 */
export function toggleSort<K extends SortKey>(current: Sort<K>, key: K): Sort<K> {
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
 * 비율 비교. 값이 없는(null) 쪽은 방향과 상관없이 뒤로 보냄
 * 0을 돌려주면 같은 값 → 호출하는 쪽에서 이름순으로 이어 비교
 */
function compareRates(rateA: number | null, rateB: number | null, sign: number) {
  // 한쪽이라도 값이 없으면 없는 쪽을 뒤로 (둘 다 없으면 0)
  if (rateA === null || rateB === null) {
    return (rateA === null ? 1 : 0) - (rateB === null ? 1 : 0)
  }
  return sign * (rateA - rateB)
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
    return sorted.sort(
      (a, b) =>
        compareRates(a.todayOccupancyRate, b.todayOccupancyRate, sign) || compareByName(a, b),
    )
  }
  // 상태: asc = 확인 불가 → 운영 중지 → 점검 중 → 충전 중 → 사용 가능, desc는 그 반대
  return sorted.sort(
    (a, b) => sign * (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || compareByName(a, b),
  )
}

/**
 * 충전소 표 정렬. 원본 배열은 그대로 두고 새 배열을 돌려줌
 * 기준 값이 같으면 방향과 상관없이 충전소명 가나다순
 */
export function sortStations(stations: AdminStation[], { key, direction }: StationSort) {
  const sign = direction === 'asc' ? 1 : -1
  const byName = (a: AdminStation, b: AdminStation) =>
    a.stationName.localeCompare(b.stationName, 'ko')
  const sorted = [...stations]
  // 충전소명: 가나다순 또는 그 역순
  if (key === 'name') return sorted.sort((a, b) => sign * byName(a, b))
  // 현재 이용률: 쓸 수 있는 충전기가 없는 충전소는 방향과 상관없이 맨 아래
  if (key === 'current') {
    return sorted.sort(
      (a, b) => compareRates(a.occupancy.rate, b.occupancy.rate, sign) || byName(a, b),
    )
  }
  // 상태: asc = 이상(고장 + 확인 불가) 대수가 많은 충전소부터, desc는 그 반대
  const issues = (station: AdminStation) => station.faultCount + station.unknownCount
  return sorted.sort((a, b) => sign * (issues(b) - issues(a)) || byName(a, b))
}

/** 이상 칸 문구 (예: '점검 · 중지 1 · 확인 불가 2'). 이상이 없으면 null */
export function formatStationIssues(station: Pick<AdminStation, 'faultCount' | 'unknownCount'>) {
  const parts = []
  // 0대인 항목은 빼고 있는 것만 이어 붙임
  if (station.faultCount > 0) parts.push(`점검 · 중지 ${station.faultCount}`)
  if (station.unknownCount > 0) parts.push(`확인 불가 ${station.unknownCount}`)
  return parts.length > 0 ? parts.join(' · ') : null
}

/** 검색어 비교용 — 띄어쓰기를 빼고 소문자로 ('망원동공영'도 '망원동 공영주차장1'에 걸리게) */
const normalizeSearchText = (text: string) => text.replace(/\s+/g, '').toLowerCase()

/** 충전소명에 검색어가 들어간 줄만 남김 (충전기 · 충전소 목록 모두). 순서는 그대로 유지 */
export function filterByStationName<T extends { stationName: string }>(rows: T[], query: string) {
  const keyword = normalizeSearchText(query)
  // 검색어가 비어 있으면(공백만 있어도) 전체를 그대로 보여 줌
  if (!keyword) return rows
  return rows.filter((row) => normalizeSearchText(row.stationName).includes(keyword))
}
