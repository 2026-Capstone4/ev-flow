import type { NationwideServiceArea, ServiceAreaCharger } from '../types/serviceArea'

/** 노선별 목록 한 줄 */
export type RouteSummary = {
  /** 노선 이름 (예: 경부선). 노선 화면 주소 · 묶음 기준 */
  routeName: string
  /** 화면 이름 (예: 경부) */
  label: string
  /** 노선 번호 배지. 번호 하나에 노선이 여럿인 경우가 있어(12 · 20 · 65번) 배지만 같고 노선은 따로 */
  routeNo: string | null
  /** 노선 양 끝 도시 (routeSeq가 작은 쪽 → 큰 쪽). 방향 버튼이 없는 노선(순환선 등)은 null */
  ends: [string, string] | null
  areaCount: number
  totalChargers: number
  availableChargers: number
}

/** '경부선' → '경부'. 노선 목록 · 화면 제목에서 '선'을 빼고 보여 줌 */
export function getRouteLabel(routeName: string) {
  return routeName.replace(/선$/, '')
}

/**
 * 노선의 방향 버튼 두 개를 [routeSeq가 작은 쪽 끝, 큰 쪽 끝] 순서로 돌려준다
 * 큰 쪽 끝으로 가는 방향은 seqOrder가 asc, 작은 쪽 끝으로 가는 방향은 desc라서 그걸로 구분함
 * 방향 버튼이 둘이 아니면(순환선 · 휴게소가 양방향 하나뿐인 노선) 빈 배열
 */
export function getRouteHeadings(areas: NationwideServiceArea[], routeName: string): string[] {
  let lowEnd: string | null = null
  let highEnd: string | null = null
  for (const area of areas) {
    // 다른 노선이거나 방향이 없는 휴게소(양방향 · 순환선)는 방향 버튼을 정하는 데 쓰지 않음
    if (area.routeName !== routeName || !area.heading) continue
    // desc 방향은 순서 번호가 작아지는 쪽이라 그 끝 도시가 작은 쪽 끝
    if (area.seqOrder === 'desc') lowEnd ??= area.heading
    // asc 방향은 순서 번호가 커지는 쪽이라 그 끝 도시가 큰 쪽 끝
    else if (area.seqOrder === 'asc') highEnd ??= area.heading
  }
  return lowEnd && highEnd ? [lowEnd, highEnd] : []
}

/** 노선 번호 숫자순, 같으면 이름순. 번호가 없으면 맨 뒤 */
function compareRoutes(a: RouteSummary, b: RouteSummary) {
  const aNo = a.routeNo ? Number(a.routeNo) : Infinity
  const bNo = b.routeNo ? Number(b.routeNo) : Infinity
  return aNo - bNo || a.routeName.localeCompare(b.routeName, 'ko')
}

/**
 * 휴게소 목록을 노선별로 묶어 노선 목록을 만든다. 노선을 못 붙인 휴게소(routeName null)는 넣지 않음
 * 휴게소 수 · 충전기 수는 두 방향을 합친 값
 */
export function summarizeRoutes(areas: NationwideServiceArea[]): RouteSummary[] {
  const routes = new Map<string, RouteSummary>()
  for (const area of areas) {
    // 노선 미확인 휴게소는 노선 목록에 넣지 않음 (지역별 화면에서 따로 보여 줌)
    if (!area.routeName) continue
    let route = routes.get(area.routeName)
    // 처음 나온 노선이면 새 줄을 만듦. 양 끝 도시는 방향 버튼 두 개가 있을 때만
    if (!route) {
      const headings = getRouteHeadings(areas, area.routeName)
      route = {
        routeName: area.routeName,
        label: getRouteLabel(area.routeName),
        routeNo: area.routeNo,
        ends: headings.length === 2 ? [headings[0], headings[1]] : null,
        areaCount: 0,
        totalChargers: 0,
        availableChargers: 0,
      }
      routes.set(area.routeName, route)
    }
    route.areaCount += 1
    route.totalChargers += area.totalChargers
    route.availableChargers += area.availableChargers
  }
  return [...routes.values()].sort(compareRoutes)
}

/**
 * 노선 화면에 보여 줄 휴게소를 운전하는 순서대로 돌려준다
 * - heading을 고르면 그 방향 휴게소 + 방향이 없는 휴게소(양방향)를 넣음
 * - heading이 null이면(방향 버튼이 없는 노선) 노선의 휴게소를 모두 넣고 순서 번호가 작은 쪽부터
 */
export function getRouteAreas(
  areas: NationwideServiceArea[],
  routeName: string,
  heading: string | null,
): NationwideServiceArea[] {
  const onRoute = areas.filter(
    (area) =>
      area.routeName === routeName &&
      (heading === null || area.heading === heading || area.heading === null),
  )
  // 고른 방향의 휴게소에서 순서 방향을 읽음. desc면 순서 번호가 큰 쪽부터 지나감
  const isDescending =
    heading !== null && onRoute.some((area) => area.heading === heading && area.seqOrder === 'desc')
  return onRoute.sort((a, b) => {
    const diff = (a.routeSeq ?? 0) - (b.routeSeq ?? 0)
    return isDescending ? -diff : diff
  })
}

/**
 * 노선 화면에서 이름 옆에 작게 붙일 표지판 방향 (예: 영덕 방향 탭의 공주휴게소 → '대전 방향')
 * 표지판 방향(towards)이 고른 방향과 같거나, 양방향 · 방향 없는 휴게소면 null
 */
export function getTowardsNote(area: NationwideServiceArea, heading: string | null) {
  // 방향 탭이 없거나 휴게소에 표지판 방향이 없으면 붙이지 않음
  if (!heading || !area.towards || area.bidirectional) return null
  return area.towards === heading ? null : `${area.towards} 방향`
}

/**
 * 같은 충전기가 운영기관 두 곳 이름으로 이중 등록된 충전소를 뺀다
 * 현대엔지니어링(statId HY…)이 현대자동차(HD…) E-pit 충전기를 한 번 더 등록한 것으로 보이고, HY 쪽은 상태가 늘 확인 불가임 (2026-11-24 확인)
 * 같은 휴게소에 충전기 수 · 용량이 똑같은 다른 충전소가 있고, HY 충전소의 충전기가 모두 확인 불가일 때만 뺌
 * 백엔드에서 HY를 빼고 보내게 되면 조건에 맞는 충전소가 없어서 그대로 돌려줌
 */
export function excludeDuplicateRegistrations(
  chargers: ServiceAreaCharger[],
): ServiceAreaCharger[] {
  const byStation = new Map<string, ServiceAreaCharger[]>()
  for (const charger of chargers) {
    byStation.set(charger.stationId, [...(byStation.get(charger.stationId) ?? []), charger])
  }
  // 충전기 수와 용량 목록이 같으면 같은 충전기 묶음으로 봄
  const signature = (list: ServiceAreaCharger[]) =>
    list
      .map((c) => c.capacityKw)
      .sort((a, b) => a - b)
      .join(',')

  const duplicateIds = new Set<string>()
  for (const [stationId, list] of byStation) {
    // HY 충전소가 아니거나 상태가 하나라도 들어오면 실제 충전소로 보고 남김
    if (!stationId.startsWith('HY') || list.some((c) => c.status !== 'unknown')) continue
    const hasTwin = [...byStation].some(
      ([otherId, other]) => otherId !== stationId && signature(other) === signature(list),
    )
    // 같은 휴게소에 똑같은 충전기 묶음이 따로 있을 때만 이중 등록으로 보고 뺌
    if (hasTwin) duplicateIds.add(stationId)
  }
  return chargers.filter((c) => !duplicateIds.has(c.stationId))
}

/**
 * 목록에서 숨길 이중 등록 휴게소 - 노선을 못 붙여 statId 하나로 온 HY 충전소 중 충전기가 모두 확인 불가인 곳
 * 같은 휴게소의 현대자동차(HD) 충전소가 따로 있어 실제 충전기는 그쪽에 보임. 양평 용문(HY000160)처럼 상태가 들어오는 곳은 남김
 * 백엔드에서 HY를 빼고 보내면 조건에 맞는 곳이 없어서 아무것도 숨기지 않음
 */
export function isDuplicateRegistrationArea(area: NationwideServiceArea) {
  return (
    area.routeName === null &&
    area.id.startsWith('HY') &&
    area.statusCounts.unknown === area.totalChargers
  )
}

/**
 * 휴게소 검색. 휴게소 이름 · 노선 이름 · 시도 · 주소에 검색어가 들어 있는 곳을 응답 순서(노선 · 길 순서)대로 돌려줌
 * 띄어쓰기는 무시함 ('천안 호두' → 천안호두휴게소). 검색어가 비어 있으면 빈 배열
 */
export function searchServiceAreas(areas: NationwideServiceArea[], query: string) {
  const normalize = (text: string | null) => (text ?? '').replace(/\s/g, '').toLowerCase()
  const keyword = normalize(query)
  // 검색어가 공백뿐이면 검색하지 않음 - 화면은 노선별 · 지역별 목록을 그대로 보여 줌
  if (!keyword) return []
  return areas.filter(
    (area) =>
      !isDuplicateRegistrationArea(area) &&
      [area.name, area.routeName, area.regionName, area.address].some((text) =>
        normalize(text).includes(keyword),
      ),
  )
}
