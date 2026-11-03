import { useMemo } from 'react'
import { useStationsQuery } from '@/hooks/useStationsQuery'
import { getDistanceMeters } from '@/lib/distance'
import { matchesFilters } from '@/lib/stationFilter'
import { matchesQuery, sortSearchResults, type StationSortKey } from '@/lib/stationSearch'
import type { LatLng } from '@/types/geo'
import type { HorizonMinutes, RecommendationFilters } from '@/types/station'

type UseSearchDataOptions = {
  origin: LatLng
  query: string
  filters: RecommendationFilters
  horizon: HorizonMinutes
  sortKey: StationSortKey
}

// 검색 · 필터 화면 데이터. 별도 API 없이 GET /stations 결과에서 거름 (SRCH · FLT, docs/api/README.md)
export function useSearchData({ origin, query, filters, horizon, sortKey }: UseSearchDataOptions) {
  const stationsQuery = useStationsQuery()
  const stations = stationsQuery.data?.stations

  const results = useMemo(() => {
    if (!stations) return undefined
    const matched = stations
      .filter((station) => matchesQuery(station, query) && matchesFilters(station, filters))
      .map((station) => ({
        station,
        distanceMeters: getDistanceMeters(origin, station),
        prediction: station.predictions.find((p) => p.horizonMinutes === horizon),
      }))
    return sortSearchResults(matched, sortKey)
  }, [stations, origin, query, filters, horizon, sortKey])

  return { results, isError: stationsQuery.isError }
}
