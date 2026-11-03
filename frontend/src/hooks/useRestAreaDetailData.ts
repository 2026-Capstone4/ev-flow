import { getApiErrorCode } from '@/api/errors'
import { useServiceAreaChargersQuery } from '@/hooks/useServiceAreasQuery'
import type { Direction, ServiceAreaCharger } from '@/types/serviceArea'

// 휴게소 상세 화면 데이터. 화면(JSX)과 분리해 RN 전환 시 그대로 재사용
export function useRestAreaDetailData(name: string, direction: Direction) {
  const query = useServiceAreaChargersQuery(name, direction)
  const chargers = query.data?.chargers

  // 한 휴게소에 운영기관이 여럿이라 운영기관별로 묶어 보여줌
  const chargersByOperator = chargers?.reduce<Map<string, ServiceAreaCharger[]>>(
    (groups, charger) =>
      groups.set(charger.operator, [...(groups.get(charger.operator) ?? []), charger]),
    new Map(),
  )

  return {
    serviceArea: query.data?.serviceArea,
    chargersByOperator: chargersByOperator ? [...chargersByOperator] : undefined,
    unknownCount: chargers?.filter((c) => c.status === 'unknown').length ?? 0,
    updatedAt: query.data ? new Date(query.data.updatedAt) : null,
    isError: query.isError,
    isNotFound: getApiErrorCode(query.error) === 'SERVICE_AREA_NOT_FOUND',
  }
}
