import { isDuplicateRegistrationArea } from './nationwideServiceArea'
import type { NationwideServiceArea } from '../types/serviceArea'
import type { ChargerStatus } from '../types/station'

/**
 * 노선 미확인 휴게소 묶기
 * 노선을 못 붙인 휴게소(민자 노선 등)는 백엔드가 충전소(statId)마다 한 줄로 보내서, 운영기관이 다르면 같은 휴게소가 여러 줄로 나옴
 * (예: 오산(과천) 휴게소 · 오산(과천)휴게소). 이름의 휴게소명 · 방향과 주소로 같은 휴게소를 찾아 한 줄로 묶음
 * 묶은 휴게소의 id는 statId를 쉼표로 이은 값 - 상세 화면이 statId마다 16번을 불러 합침
 */

/** 묶은 휴게소 id에서 statId를 나누는 기호. statId · 휴게소명에는 쉼표가 없음 */
export const AREA_ID_SEPARATOR = ','

/** 묶은 휴게소 id → 16번 요청 id 목록 */
export function splitAreaIds(id: string) {
  return id.split(AREA_ID_SEPARATOR).filter(Boolean)
}

/**
 * 방향 표기는 같은데 이름의 도시가 다른 휴게소 (휴게소명 → { 다른 표기: 대표 표기 })
 * 삼국유사군위휴게소는 사업자마다 같은 쪽을 '서울'과 '상주'로 적음 (주소 · 좌표가 같음, 2026-11-24 확인)
 */
const DIRECTION_ALIASES: Record<string, Record<string, string>> = {
  삼국유사군위: { 서울: '상주' },
}

/** 상행 · 하행은 실제 방향 도시를 모르는 약한 표기라, 같은 주소의 도시 방향 휴게소와 합칠 수 있음 */
const WEAK_DIRECTIONS = new Set(['상행', '하행'])

export type ParsedUnmatchedName = {
  /** 띄어쓰기를 뺀 휴게소명 (묶는 기준). 예: 오산 */
  key: string
  /** 화면에 쓸 휴게소명 (띄어쓰기 유지). 예: 안산 시화나래 */
  label: string
  /** 방향. 도시 이름(과천) · 상행 · 하행 · 없으면 null */
  direction: string | null
}

/**
 * 노선 미확인 휴게소 이름에서 휴게소명과 방향을 읽는다
 * '오산(과천) 휴게소' · '송산포도휴게소(시흥방향)' · '예산예당호휴게소 익산방향' · '경기광주휴게소 상행선' · '서하남 간이 휴게소 (판교)'
 */
export function parseUnmatchedName(name: string): ParsedUnmatchedName {
  const paren = name.match(/\(([^)]*)\)/)
  const withoutParen = paren ? name.replace(paren[0], ' ') : name
  const [before, ...after] = withoutParen.split('휴게소')
  // 괄호가 있으면 괄호 안이 방향, 없으면 '휴게소' 뒤에 붙은 글자(익산방향 · 상행선)가 방향
  const rawDirection = (paren ? paren[1] : after.join('')).replace(/\s/g, '')
  const label = before.replace(/간이/g, ' ').replace(/\s+/g, ' ').trim()
  const key = label.replace(/\s/g, '')
  let direction: string | null = rawDirection.replace(/방향$/, '').replace(/^(상행|하행)선$/, '$1')
  // 방향 글자가 없으면 방향 없음
  if (!direction) direction = null
  // 같은 쪽을 다른 도시로 적은 휴게소는 대표 표기로 맞춤
  if (direction && DIRECTION_ALIASES[key]?.[direction])
    direction = DIRECTION_ALIASES[key][direction]
  return { key, label, direction }
}

/** 방향이 없거나 상행 · 하행뿐이면 약한 방향 */
function isWeakDirection(direction: string | null) {
  return direction === null || WEAK_DIRECTIONS.has(direction)
}

/** 묶음 하나 - 같은 휴게소 · 같은 방향으로 본 충전소들 */
type Cluster = { parsed: ParsedUnmatchedName; members: NationwideServiceArea[] }

/**
 * 같은 휴게소명끼리 묶는다
 * 1. 방향 표기가 같으면 한 묶음 (오산(과천) 휴게소 + 오산(과천)휴게소)
 * 2. 방향이 없거나 상행 · 하행뿐인 묶음은, 주소가 같은 도시 방향 묶음이 딱 하나 있으면 그쪽에 합침 (군위영천 (하행) → (영천))
 * 도시 방향끼리는 주소가 같아도 합치지 않음 - 송산포도는 시흥 · 평택 방향이 같은 주소를 씀
 */
function clusterByName(areas: NationwideServiceArea[]): Cluster[] {
  const clusters: Cluster[] = []
  for (const area of areas) {
    const parsed = parseUnmatchedName(area.name)
    const same = clusters.find(
      (c) => c.parsed.key === parsed.key && c.parsed.direction === parsed.direction,
    )
    // 휴게소명과 방향이 같은 묶음이 있으면 거기에 넣고, 없으면 새 묶음
    if (same) same.members.push(area)
    else clusters.push({ parsed, members: [area] })
  }

  const merged: Cluster[] = []
  const weak = clusters.filter((c) => isWeakDirection(c.parsed.direction))
  const strong = clusters.filter((c) => !isWeakDirection(c.parsed.direction))
  for (const cluster of weak) {
    const addresses = new Set(cluster.members.map((m) => m.address))
    const targets = strong.filter(
      (s) => s.parsed.key === cluster.parsed.key && s.members.some((m) => addresses.has(m.address)),
    )
    // 주소가 같은 도시 방향 묶음이 하나뿐이면 그쪽에 합침. 없거나 여럿이면(어느 쪽인지 모름) 따로 둠
    if (targets.length === 1) targets[0].members.push(...cluster.members)
    else merged.push(cluster)
  }
  return [...strong, ...merged]
}

/** 묶음 화면 이름. 도시 방향은 '오산휴게소 (과천 방향)', 상행 · 하행은 '경기광주휴게소 (상행)', 방향이 없으면 '별내휴게소' */
function clusterName({ label, direction }: ParsedUnmatchedName) {
  const name = `${label}휴게소`
  // 방향이 없으면 휴게소명만
  if (!direction) return name
  return WEAK_DIRECTIONS.has(direction) ? `${name} (${direction})` : `${name} (${direction} 방향)`
}

/** 묶음의 충전소들을 휴게소 한 곳으로 합친다. 위치 · 주소 · 지역은 충전기가 가장 많은 충전소 기준 */
function mergeCluster({ parsed, members }: Cluster): NationwideServiceArea {
  const rep = [...members].sort((a, b) => b.totalChargers - a.totalChargers)[0]
  const statusCounts = { ...rep.statusCounts }
  for (const member of members) {
    // 대표 충전소는 이미 넣었으니 나머지만 더함
    if (member === rep) continue
    for (const status of Object.keys(statusCounts) as ChargerStatus[]) {
      statusCounts[status] += member.statusCounts[status]
    }
  }
  const name = clusterName(parsed)
  return {
    ...rep,
    id: members.map((m) => m.id).join(AREA_ID_SEPARATOR),
    name,
    shortName: name,
    totalChargers: members.reduce((sum, m) => sum + m.totalChargers, 0),
    availableChargers: members.reduce((sum, m) => sum + m.availableChargers, 0),
    statusCounts,
  }
}

/**
 * 화면에 보여 줄 휴게소 목록 - 노선이 붙은 휴게소는 그대로, 노선 미확인은 같은 휴게소끼리 묶고 이중 등록(HY)은 뺌
 * 응답 순서(노선 · 길 순서, 노선 미확인은 맨 뒤)를 유지하고, 노선 미확인은 이름순
 */
export function toDisplayAreas(areas: NationwideServiceArea[]): NationwideServiceArea[] {
  const matched = areas.filter((area) => area.routeName !== null)
  const unmatched = areas.filter(
    (area) => area.routeName === null && !isDuplicateRegistrationArea(area),
  )
  const grouped = clusterByName(unmatched)
    .map(mergeCluster)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  return [...matched, ...grouped]
}

/**
 * 상세 화면 제목 - 묶은 휴게소(id가 여럿)는 목록과 같은 규칙으로 이름을 다시 만듦
 * 충전소 하나(노선이 붙은 곳 포함)면 받은 이름 그대로
 */
export function getMergedAreaName(names: string[]) {
  // 충전소 하나면 서버가 준 이름을 그대로 씀
  if (names.length <= 1) return names[0] ?? ''
  const parsed = names.map(parseUnmatchedName)
  // 도시 방향이 있는 이름을 우선 씀 (군위영천 (영천) + (하행) → 영천 방향)
  const best = parsed.find((p) => !isWeakDirection(p.direction)) ?? parsed[0]
  return clusterName(best)
}
