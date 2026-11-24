import { useNationwideServiceAreasQuery } from './useServiceAreasQuery'
import { getListLoadState } from '../lib/loadState'
import { getRouteAreas, getRouteHeadings } from '../lib/nationwideServiceArea'

/**
 * 노선 화면 데이터. 목록 화면과 같은 쿼리(전국 휴게소 목록)에서 이 노선만 골라냄
 * requestedHeading은 화면 주소의 방향 값. 없거나 이 노선의 방향이 아니면 첫 번째 방향을 씀
 */
export function useServiceAreaRouteData(routeName: string, requestedHeading: string | null) {
  const query = useNationwideServiceAreasQuery()
  const all = query.data?.serviceAreas
  const headings = all ? getRouteHeadings(all, routeName) : []
  // 방향 버튼이 없는 노선(순환선 등)은 방향 없이 노선 전체를 보여 줌
  const heading =
    headings.length === 0
      ? null
      : requestedHeading && headings.includes(requestedHeading)
        ? requestedHeading
        : headings[0]
  const areas = all ? getRouteAreas(all, routeName, heading) : undefined
  const routeAreas = all?.filter((area) => area.routeName === routeName)

  return {
    areas,
    headings,
    heading,
    routeNo: routeAreas?.[0]?.routeNo ?? null,
    /** 두 방향을 합친 노선 전체 휴게소 수 · 사용 가능 충전기 수 */
    areaCount: routeAreas?.length,
    availableChargers: routeAreas?.reduce((sum, area) => sum + area.availableChargers, 0),
    updatedAt: query.data ? new Date(query.data.updatedAt) : null,
    isError: query.isError,
    loadState: getListLoadState(areas, query.isError),
  }
}
