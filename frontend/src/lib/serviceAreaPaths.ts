// 휴게소 화면 주소. 목록 · 노선 · 지역 화면이 같은 규칙으로 서로를 엶

/** 노선 화면 (/service-areas/route?name=경부선&heading=부산). heading은 고른 방향, 없으면 첫 번째 방향 */
export function toServiceAreaRoutePath(routeName: string) {
  return `/service-areas/route?${new URLSearchParams({ name: routeName })}`
}

/** 지역 화면 (/service-areas/region?code=41). code가 unmatched면 노선 미확인 휴게소 */
export function toServiceAreaRegionPath(code: string) {
  return `/service-areas/region?${new URLSearchParams({ code })}`
}

/** 휴게소 상세 (/service-areas/detail?id=). id는 15번 목록의 id - 노선 미확인을 묶은 곳은 statId를 쉼표로 이은 값 */
export function toServiceAreaDetailPath(id: string) {
  return `/service-areas/detail?${new URLSearchParams({ id })}`
}
