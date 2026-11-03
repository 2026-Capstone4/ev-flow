import { getApiErrorCode } from '@/api/errors'
import { useStationQuery } from '@/hooks/useStationsQuery'
import type { HorizonMinutes } from '@/types/station'

// 충전소 상세 화면 데이터. 화면(JSX)과 분리해 RN 전환 시 그대로 재사용
export function useStationDetailData(stationId: string, horizon: HorizonMinutes) {
  const query = useStationQuery(stationId)
  const station = query.data?.station

  return {
    station,
    updatedAt: query.data ? new Date(query.data.updatedAt) : null,
    isError: query.isError,
    isNotFound: getApiErrorCode(query.error) === 'STATION_NOT_FOUND',
    selectedPrediction: station?.predictions.find((p) => p.horizonMinutes === horizon),
  }
}
