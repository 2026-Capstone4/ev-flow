import type { Charger, Station } from '../types/station'

/**
 * 원천 데이터 문제로 30분마다 사용 가능(2) ↔ 상태 미확인(9)을 반복하는 충전기 (docs/database.md 데이터 사용 시 주의)
 * 그 사이에도 충전 세션이 있어 고장으로 보지 않음. backend/scripts/export_dataset.py의 UNSTABLE_CHARGERS와 같은 목록이라 바뀌면 두 곳을 같이 고침
 */
export const UNSTABLE_CHARGER_KEYS: ReadonlySet<string> = new Set([
  'ME19A245-21',
  'ME19A245-22',
  'ME19A246-21',
  'ME19A246-22',
  'ME19A265-21',
  'ME19A265-22',
  'ME19A601-21',
  'ME19A601-22',
  'ME19A601-23',
  'ME19A601-24',
  'ME19A601-25',
  'ME19A601-26',
  'ME21B180-01',
  'ME21B412-01',
  'ME21B412-02',
  'ME21B412-03',
  'ME21B412-04',
])

/**
 * 한글 이름 비교. localeCompare(..., 'ko')와 같은 순서
 * Android Hermes에서 localeCompare(..., 'ko')는 한 번에 0.3ms쯤 걸려서(실기기에서 잼), 한 번 만든 Collator를 계속 씀
 */
const koreanCollator = new Intl.Collator('ko')

/** 구 선택 목록 맨 위 '전체'. 고르면 서울 전체 충전소를 보여 줌 (실제 구 이름과 겹치지 않음) */
export const ALL_DISTRICTS = '전체'

/** 충전소 ID와 충전기 ID로 불안정 충전기인지 확인함 (목록 키 형식: 충전소ID-충전기ID) */
export function isUnstableCharger(stationId: string, chargerId: string) {
  return UNSTABLE_CHARGER_KEYS.has(`${stationId}-${chargerId}`)
}

/** 주소에서 구 이름을 뽑음 (예: 서울특별시 마포구 월드컵로 240 → 마포구). 구가 없으면 null */
export function getDistrict(address: string) {
  return address.match(/(\S+구)(?=\s|$)/)?.[1] ?? null
}

/** 상태 이상 종류. 칩 '전체'는 둘 다 */
export type ChargerIssueKind = 'unknown' | 'unstable'
export type ChargerIssueFilter = 'all' | ChargerIssueKind

/** 상태 이상 충전기 목록의 충전소 한 곳. 해당하는 충전기만 담음 */
export type StationChargerIssues = Pick<Station, 'stationId' | 'name' | 'address'> & {
  chargers: Charger[]
}

export type ChargerIssues = {
  /** 상태를 확인할 수 없는 충전기(불안정 충전기는 뺌). 대수가 많은 충전소부터 */
  unknown: StationChargerIssues[]
  /** 불안정 충전기 중 지금 확인 불가인 것. 충전소 이름순 */
  unstable: StationChargerIssues[]
  unknownCount: number
  unstableCount: number
}

/**
 * 충전소 목록에서 지금 확인 불가인 충전기를 골라 충전소별로 묶음
 * 불안정 충전기는 불안정 쪽에만 넣음. 원래 상태가 오가는 충전기라 진짜 미확인과 나눠 보여 줌
 * 지금 사용 가능 · 충전 중인 불안정 충전기는 문제가 없으니 넣지 않음
 */
export function groupChargerIssues(stations: Station[]): ChargerIssues {
  const unknown: StationChargerIssues[] = []
  const unstable: StationChargerIssues[] = []

  for (const station of stations) {
    const unstableChargers: Charger[] = []
    const unknownChargers: Charger[] = []
    for (const charger of station.chargers) {
      // 지금 상태를 아는 충전기는 목록에 넣지 않음
      if (charger.status !== 'unknown') continue
      // 불안정 목록에 있으면 불안정 쪽, 아니면 미확인 쪽
      if (isUnstableCharger(station.stationId, charger.chargerId)) {
        unstableChargers.push(charger)
      } else {
        unknownChargers.push(charger)
      }
    }
    const base = { stationId: station.stationId, name: station.name, address: station.address }
    // 해당하는 충전기가 있는 충전소만 목록에 넣음
    if (unstableChargers.length > 0) unstable.push({ ...base, chargers: unstableChargers })
    if (unknownChargers.length > 0) unknown.push({ ...base, chargers: unknownChargers })
  }

  const byName = (a: StationChargerIssues, b: StationChargerIssues) =>
    koreanCollator.compare(a.name, b.name)
  // 미확인은 많이 끊긴 충전소부터, 대수가 같으면 이름순
  unknown.sort((a, b) => b.chargers.length - a.chargers.length || byName(a, b))
  unstable.sort(byName)

  const countChargers = (list: StationChargerIssues[]) =>
    list.reduce((sum, station) => sum + station.chargers.length, 0)
  return {
    unknown,
    unstable,
    unknownCount: countChargers(unknown),
    unstableCount: countChargers(unstable),
  }
}

/** 구 선택 목록의 한 줄. count = 그 구에서 지금 확인 불가인 충전기 수 */
export type DistrictIssueCount = { district: string; count: number }

/**
 * 충전소가 있는 구마다 확인 불가 충전기 수를 셈. 0인 구도 고를 수 있게 넣고, 구 이름순
 * 맨 위에는 모든 충전소를 합친 '전체'를 둠
 */
export function countIssuesByDistrict(stations: Station[]): DistrictIssueCount[] {
  const counts = new Map<string, number>()
  let total = 0
  for (const station of stations) {
    const unknownCount = station.chargers.filter((c) => c.status === 'unknown').length
    // 전체에는 주소에 구가 없는 충전소도 셈
    total += unknownCount
    const district = getDistrict(station.address)
    // 주소에 구가 없으면 어느 구에도 넣지 않음
    if (!district) continue
    counts.set(district, (counts.get(district) ?? 0) + unknownCount)
  }
  const districts = [...counts]
    .map(([district, count]) => ({ district, count }))
    .sort((a, b) => koreanCollator.compare(a.district, b.district))
  return [{ district: ALL_DISTRICTS, count: total }, ...districts]
}

/** 고른 구의 충전소만 남김. '전체'면 모두 */
export function filterStationsByDistrict(stations: Station[], district: string) {
  // 전체를 골랐으면 거르지 않음
  if (district === ALL_DISTRICTS) return stations
  return stations.filter((station) => getDistrict(station.address) === district)
}
