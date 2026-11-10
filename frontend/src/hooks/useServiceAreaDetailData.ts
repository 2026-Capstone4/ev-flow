import { getApiErrorCode } from '@/api/errors'
import { useServiceAreaChargersQuery } from '@/hooks/useServiceAreasQuery'
import { groupChargersByOperator } from '@/lib/serviceArea'
import type { Direction } from '@/types/serviceArea'

// 휴게소 상세 화면 데이터. 화면(JSX)과 분리해 RN 전환 시 그대로 재사용
export function useServiceAreaDetailData(name: string, direction: Direction) {
  const query = useServiceAreaChargersQuery(name, direction)
  const chargers = query.data?.chargers

  return {
    serviceArea: query.data?.serviceArea,
    // 한 휴게소에 운영기관 · 충전소가 여럿이라 묶어서 보여줌
    chargerGroups: chargers ? groupChargersByOperator(chargers) : undefined,
    unknownCount: chargers?.filter((c) => c.status === 'unknown').length ?? 0,
    updatedAt: query.data ? new Date(query.data.updatedAt) : null,
    isError: query.isError,
    isNotFound: getApiErrorCode(query.error) === 'SERVICE_AREA_NOT_FOUND',
  }
}
