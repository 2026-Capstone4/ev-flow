import { getApiErrorCode } from '@/api/errors'
import { useRouteQuery, useStationQuery } from '@/hooks/useStationsQuery'
import type { LatLng } from '@/types/geo'
import type { HorizonMinutes } from '@/types/station'

/** 다시 시도해도 결과가 같은 경로 오류 (UC-U07 E2). 그 외는 재시도 안내 */
const ROUTE_UNAVAILABLE_CODES = ['ROUTE_NOT_FOUND', 'ROUTE_QUOTA_EXCEEDED']

// 길찾기 화면 데이터. 화면(JSX)과 분리해 RN 전환 시 그대로 재사용
export function useRouteData(origin: LatLng, stationId: string, horizon: HorizonMinutes) {
  const stationQuery = useStationQuery(stationId)
  const routeQuery = useRouteQuery(origin, stationId)
  const station = stationQuery.data?.station
  const routeErrorCode = getApiErrorCode(routeQuery.error)

  return {
    station,
    route: routeQuery.data,
    prediction: station?.predictions.find((p) => p.horizonMinutes === horizon),
    isStationError: stationQuery.isError,
    isRouteError: routeQuery.isError,
    /** true면 재시도 버튼 대신 다른 충전소를 고르도록 안내 */
    isRouteUnavailable: routeErrorCode !== null && ROUTE_UNAVAILABLE_CODES.includes(routeErrorCode),
    retryRoute: () => routeQuery.refetch(),
  }
}
