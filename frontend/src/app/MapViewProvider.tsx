import { useMemo, useState, type ReactNode } from 'react'
import { MapViewContext } from '@/app/mapViewContext'
import { DEFAULT_HORIZON } from '@/lib/constants'
import { DEFAULT_FILTERS } from '@/lib/stationFilter'
import type { HorizonMinutes, RecommendationFilters } from '@/types/station'

export function MapViewProvider({ children }: { children: ReactNode }) {
  const [horizon, setHorizon] = useState<HorizonMinutes>(DEFAULT_HORIZON)
  const [filters, setFilters] = useState<RecommendationFilters>(DEFAULT_FILTERS)
  const value = useMemo(() => ({ horizon, setHorizon, filters, setFilters }), [horizon, filters])
  return <MapViewContext.Provider value={value}>{children}</MapViewContext.Provider>
}
