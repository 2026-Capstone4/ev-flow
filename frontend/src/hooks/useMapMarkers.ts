import { createElement, useEffect, useRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
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

// 인증 실패 시 SDK가 naver.maps를 null로 비워 마커 정리 호출도 예외를 던짐 (지도는 안내 화면으로 가려짐)
function isSdkDisabled() {
  return !window.naver.maps
}

// 마커 모양을 정하는 값만 이어 붙인 키 - 키가 같으면 아이콘을 다시 만들지 않음
function toMarkerKey(station: Station) {
  return `${station.availableChargers}/${station.totalChargers}/${station.congestion}`
}

function toMarkerIcon(station: Station): naver.maps.HtmlIcon {
  return {
    content: `<div style="transform: translate(-50%, -50%)">${toMarkerHtml(station)}</div>`,
  }
}

type MarkerEntry = {
  marker: naver.maps.Marker
  listener: naver.maps.MapEventListener
  station: Station
  key: string
}

/**
 * 충전소 마커를 충전소 ID별로 유지하고, 폴링으로 목록이 새로 와도 바뀐 마커만 고침.
 * 전부 지우고 다시 만들면 충전소가 많을 때 폴링마다 화면이 멈칫함
 */
export function useStationMarkers(
  map: naver.maps.Map | null,
  stations: Station[] | undefined,
  onSelect?: (station: Station) => void,
) {
  const entriesRef = useRef(new Map<string, MarkerEntry>())
  // 클릭 처리는 최신 함수만 ref로 읽음 - 함수가 바뀌어도 마커를 다시 만들지 않음
  const onSelectRef = useRef(onSelect)
  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  // 지도가 바뀌거나 화면을 벗어날 때만 마커를 모두 지움
  useEffect(() => {
    if (!map) return
    const entries = entriesRef.current
    return () => {
      // 인증 실패로 SDK가 비워졌으면 정리 호출도 예외를 던지므로 목록만 비움
      if (!isSdkDisabled()) {
        entries.forEach(({ marker, listener }) => {
          window.naver.maps.Event.removeListener(listener)
          marker.setMap(null)
        })
      }
      entries.clear()
    }
  }, [map])

  useEffect(() => {
    if (!map || !stations) return
    const { maps } = window.naver
    const entries = entriesRef.current
    const nextIds = new Set<string>()

    stations.forEach((station) => {
      nextIds.add(station.stationId)
      const key = toMarkerKey(station)
      const entry = entries.get(station.stationId)

      // 처음 보는 충전소면 마커를 새로 만듦
      if (!entry) {
        const marker = new maps.Marker({
          map,
          position: new maps.LatLng(station.lat, station.lng),
          title: station.name,
          icon: toMarkerIcon(station),
        })
        // 클릭 시점의 최신 충전소 정보를 넘기도록 목록에서 다시 꺼냄
        const listener = maps.Event.addListener(marker, 'click', () => {
          const latest = entries.get(station.stationId)?.station ?? station
          onSelectRef.current?.(latest)
        })
        entries.set(station.stationId, { marker, listener, station, key })
        return
      }

      // 사용 가능 대수 · 혼잡도가 바뀐 마커만 아이콘을 새로 그림
      if (entry.key !== key) {
        entry.marker.setIcon(toMarkerIcon(station))
        entry.key = key
      }
      // 좌표 · 이름은 거의 바뀌지 않지만 바뀌었으면 맞춰 줌
      if (entry.station.lat !== station.lat || entry.station.lng !== station.lng) {
        entry.marker.setPosition(new maps.LatLng(station.lat, station.lng))
      }
      if (entry.station.name !== station.name) {
        entry.marker.setTitle(station.name)
      }
      entry.station = station
    })

    // 새 목록에 없는 충전소(필터로 빠졌거나 대상에서 제외됨)는 마커를 지움
    entries.forEach((entry, stationId) => {
      if (nextIds.has(stationId)) return
      maps.Event.removeListener(entry.listener)
      entry.marker.setMap(null)
      entries.delete(stationId)
    })
  }, [map, stations])
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
    return () => {
      if (!isSdkDisabled()) marker.setMap(null)
    }
  }, [map, location])
}
