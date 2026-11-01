import { useState } from 'react'
import { useRecommendationsQuery, useStationsQuery } from '@/hooks/useStationsQuery'
import { DEFAULT_HORIZON } from '@/lib/constants'
import { getListLoadState } from '@/lib/loadState'
import type { LatLng } from '@/types/geo'
import type { HorizonMinutes } from '@/types/station'

// 지도 홈 화면 데이터. 화면(JSX)과 분리해 RN 전환 시 그대로 재사용
export function useMapHomeData(origin: LatLng) {
  const [horizon, setHorizon] = useState<HorizonMinutes>(DEFAULT_HORIZON)
  const stationsQuery = useStationsQuery(horizon)
  const recommendationsQuery = useRecommendationsQuery(horizon, origin)
  const recommendations = recommendationsQuery.data?.recommendations

  return {
    horizon,
    setHorizon,
    stations: stationsQuery.data?.stations,
    updatedAt: stationsQuery.data ? new Date(stationsQuery.data.updatedAt) : null,
    isStationsError: stationsQuery.isError,
    topRecommendation: recommendations?.[0],
    recommendState: getListLoadState(recommendations, recommendationsQuery.isError),
  }
}
