import { getApiErrorCode } from '../api/errors'
import { useNationwideServiceAreaChargersQueries } from './useServiceAreasQuery'
import { excludeDuplicateRegistrations } from '../lib/nationwideServiceArea'
import { groupChargersByOperator } from '../lib/serviceArea'
import { getMergedAreaName, splitAreaIds } from '../lib/unmatchedServiceArea'

/**
 * 전국 휴게소 상세 화면 데이터. id는 목록의 id - 노선 미확인을 묶은 휴게소는 statId를 쉼표로 이은 값
 * statId마다 받은 충전기를 합치고, 이중 등록 충전소(HY)를 빼고 충전기 수 · 사용 가능 수를 다시 셈
 */
export function useNationwideServiceAreaDetailData(id: string) {
  const queries = useNationwideServiceAreaChargersQueries(splitAreaIds(id))
  const responses = queries.flatMap((q) => (q.data ? [q.data] : []))
  // 모든 statId 응답이 와야 화면을 그림 - 일부만 그리면 충전기 수가 오락가락함
  const isReady = queries.length > 0 && responses.length === queries.length
  const chargers = isReady
    ? excludeDuplicateRegistrations(responses.flatMap((r) => r.chargers))
    : undefined
  const serviceArea =
    isReady && chargers
      ? {
          ...responses[0].serviceArea,
          name: getMergedAreaName(responses.map((r) => r.serviceArea.name)),
          totalChargers: chargers.length,
          availableChargers: chargers.filter((c) => c.status === 'available').length,
        }
      : undefined
  // 기준 시각은 가장 오래된 응답 - 여럿 중 하나라도 늦으면 늦은 쪽을 보여 줌
  const updatedAt = isReady
    ? new Date(Math.min(...responses.map((r) => new Date(r.updatedAt).getTime())))
    : null

  return {
    serviceArea,
    // 한 휴게소에 운영기관 · 충전소가 여럿이라 묶어서 보여줌
    chargerGroups: chargers ? groupChargersByOperator(chargers) : undefined,
    unknownCount: chargers?.filter((c) => c.status === 'unknown').length ?? 0,
    updatedAt,
    isError: queries.some((q) => q.isError),
    // 하나라도 없는 휴게소면 찾을 수 없음으로 봄 (목록이 바뀌어 묶음이 달라진 경우)
    isNotFound: queries.some((q) => getApiErrorCode(q.error) === 'SERVICE_AREA_NOT_FOUND'),
  }
}
