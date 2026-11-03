import { useContext } from 'react'
import { MapViewContext } from '@/app/mapViewContext'

export function useMapView() {
  const mapView = useContext(MapViewContext)
  if (!mapView) throw new Error('MapViewProvider 안에서만 쓸 수 있음')
  return mapView
}
