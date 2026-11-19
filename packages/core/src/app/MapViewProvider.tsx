import { useMemo, useState, type ReactNode } from 'react'
import { MapViewContext } from './mapViewContext'
import { DEFAULT_HORIZON, DEMO_USER_LOCATION } from '../lib/constants'
import { DEFAULT_FILTERS } from '../lib/stationFilter'
import type { LatLng } from '../types/geo'
import type { HorizonMinutes, RecommendationFilters } from '../types/station'

export function MapViewProvider({ children }: { children: ReactNode }) {
  const [horizon, setHorizon] = useState<HorizonMinutes>(DEFAULT_HORIZON)
  const [filters, setFilters] = useState<RecommendationFilters>(DEFAULT_FILTERS)
  const [userLocation, setUserLocation] = useState<LatLng>(DEMO_USER_LOCATION)
  const value = useMemo(
    () => ({ horizon, setHorizon, filters, setFilters, userLocation, setUserLocation }),
    [horizon, filters, userLocation],
  )
  return <MapViewContext.Provider value={value}>{children}</MapViewContext.Provider>
}
