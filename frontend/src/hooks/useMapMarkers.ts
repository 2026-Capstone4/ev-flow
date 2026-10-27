import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useEffect } from 'react'
import { StationMarker } from '@/components/StationMarker'
import myLocationIcon from '@/assets/my-location.svg'
import type { LatLng } from '@/types/geo'
import type { Station } from '@/types/station'

// 네이버 지도 마커는 HTML 문자열만 받으므로 React 컴포넌트를 정적 마크업으로 변환
function toMarkerHtml(station: Station) {
  return renderToStaticMarkup(
    createElement(StationMarker, {
      availableChargers: station.availableChargers,
      totalChargers: station.totalChargers,
      congestion: station.congestion,
    }),
  )
}

export function useStationMarkers(
  map: naver.maps.Map | null,
  stations: Station[] | undefined,
  onSelect?: (station: Station) => void,
) {
  useEffect(() => {
    if (!map || !stations) return
    const { maps } = window.naver

    const markers = stations.map((station) => {
      const marker = new maps.Marker({
        map,
        position: new maps.LatLng(station.lat, station.lng),
        title: station.name,
        icon: {
          content: `<div style="transform: translate(-50%, -50%)">${toMarkerHtml(station)}</div>`,
        },
      })
      const listener = maps.Event.addListener(marker, 'click', () => onSelect?.(station))
      return { marker, listener }
    })

    return () => {
      markers.forEach(({ marker, listener }) => {
        maps.Event.removeListener(listener)
        marker.setMap(null)
      })
    }
  }, [map, stations, onSelect])
}

export function useMyLocationMarker(map: naver.maps.Map | null, location: LatLng) {
  useEffect(() => {
    if (!map) return
    const { maps } = window.naver
    const marker = new maps.Marker({
      map,
      position: new maps.LatLng(location.lat, location.lng),
      clickable: false,
      zIndex: -1,
      icon: {
        url: myLocationIcon,
        size: new maps.Size(34, 34),
        anchor: new maps.Point(17, 15),
      },
    })
    return () => marker.setMap(null)
  }, [map, location])
}
