import { getApiErrorCode } from '../api/errors'
import { useNationwideServiceAreaChargersQuery } from './useServiceAreasQuery'
import { excludeDuplicateRegistrations } from '../lib/nationwideServiceArea'
import { groupChargersByOperator } from '../lib/serviceArea'

// 전국 휴게소 상세 화면 데이터. 이중 등록 충전소(HY)를 빼고 충전기 수 · 사용 가능 수를 다시 셈
export function useNationwideServiceAreaDetailData(id: string) {
  const query = useNationwideServiceAreaChargersQuery(id)
  const chargers = query.data ? excludeDuplicateRegistrations(query.data.chargers) : undefined
  const serviceArea =
    query.data && chargers
      ? {
          ...query.data.serviceArea,
          totalChargers: chargers.length,
          availableChargers: chargers.filter((c) => c.status === 'available').length,
        }
      : undefined

  return {
    serviceArea,
    // 한 휴게소에 운영기관 · 충전소가 여럿이라 묶어서 보여줌
    chargerGroups: chargers ? groupChargersByOperator(chargers) : undefined,
    unknownCount: chargers?.filter((c) => c.status === 'unknown').length ?? 0,
    updatedAt: query.data ? new Date(query.data.updatedAt) : null,
    isError: query.isError,
    isNotFound: getApiErrorCode(query.error) === 'SERVICE_AREA_NOT_FOUND',
  }
}
