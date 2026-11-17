import { createElement, useEffect, useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StationMarker } from '@/components/StationMarker'
import myLocationIcon from '@/assets/my-location.svg'
import type { LatLng } from '@/types/geo'
import type { Station } from '@/types/station'

/** 이 줌 이하에서는 숫자 대신 색 점으로 그림. 줌 13 ≈ 모바일 화면 가로 6km, 알약끼리 겹치기 시작함 */
const COMPACT_MAX_ZOOM = 13
/** 이 줌 이하에서는 마커를 숨김. 줌 11이면 서울 대부분이 화면에 들어와 1,600여 개를 모두 그리게 됨 */
const HIDDEN_MAX_ZOOM = 11
/** 색 점을 누르면 이 줌으로 확대해 숫자 마커를 보여 줌 (지도 첫 화면과 같은 줌) */
const COMPACT_TAP_ZOOM = 14

// 네이버 지도 마커는 HTML 문자열만 받으므로 React 컴포넌트를 정적 마크업으로 변환
function toMarkerHtml(station: Station, isCompact: boolean) {
  return renderToStaticMarkup(
    createElement(StationMarker, {
      availableChargers: station.availableChargers,
      totalChargers: station.totalChargers,
      congestion: station.congestion,
      isCompact,
    }),
  )
}

function isCompactZoom(map: naver.maps.Map) {
  return map.getZoom() <= COMPACT_MAX_ZOOM
}

function isHiddenZoom(map: naver.maps.Map) {
  return map.getZoom() <= HIDDEN_MAX_ZOOM
}

// 인증 실패 시 SDK가 naver.maps를 null로 비워 마커 정리 호출도 예외를 던짐 (지도는 안내 화면으로 가려짐)
function isSdkDisabled() {
  return !window.naver.maps
}

// 마커 모양을 정하는 값만 이어 붙인 키 - 키가 같으면 아이콘을 다시 만들지 않음
function toMarkerKey(station: Station, isCompact: boolean) {
  return `${station.availableChargers}/${station.totalChargers}/${station.congestion}/${isCompact}`
}

function toMarkerIcon(station: Station, isCompact: boolean): naver.maps.HtmlIcon {
  return {
    content: `<div style="transform: translate(-50%, -50%)">${toMarkerHtml(station, isCompact)}</div>`,
  }
}

type MarkerEntry = {
  marker: naver.maps.Marker
  listener: naver.maps.MapEventListener
  station: Station
  key: string
  /** 지금 지도에 붙어 있는지. 화면 밖으로 나가면 떼어 두고 다시 들어오면 재사용 */
  isOnMap: boolean
}

type ViewBounds = { south: number; west: number; north: number; east: number }

/** 화면 크기의 이 비율만큼 바깥까지 미리 그림. 지도를 조금 끌 때 마커가 늦게 뜨지 않게 함 */
const VIEW_MARGIN_RATIO = 0.3

// 지금 화면 범위에 여유를 더한 위경도 범위. Point는 x = 경도, y = 위도
function readViewBounds(map: naver.maps.Map): ViewBounds {
  const bounds = map.getBounds()
  const min = bounds.getMin()
  const max = bounds.getMax()
  const latMargin = (max.y - min.y) * VIEW_MARGIN_RATIO
  const lngMargin = (max.x - min.x) * VIEW_MARGIN_RATIO
  return {
    south: min.y - latMargin,
    west: min.x - lngMargin,
    north: max.y + latMargin,
    east: max.x + lngMargin,
  }
}

function isInView(station: Station, view: ViewBounds) {
  return (
    station.lat >= view.south &&
    station.lat <= view.north &&
    station.lng >= view.west &&
    station.lng <= view.east
  )
}

/**
 * 충전소 마커를 충전소 ID별로 유지하고, 폴링으로 목록이 새로 와도 바뀐 마커만 고침.
 * 전부 지우고 다시 만들면 충전소가 많을 때 폴링마다 화면이 멈칫함.
 * 서울 전역은 수천 곳이라 화면(+ 여유) 안의 충전소만 지도에 붙이고, 멀리 볼 때는 색 점으로 그리고,
 * 더 멀리 보면 숨김. 숨겼는지(isZoomedOut)를 돌려줘 화면에서 확대 안내를 띄우게 함
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

  // 지도 이동 · 확대가 끝날 때마다 숫자를 올려 마커를 화면 범위 · 줌에 다시 맞춤
  const [viewVersion, setViewVersion] = useState(0)
  useEffect(() => {
    if (!map) return
    const { maps } = window.naver
    const listener = maps.Event.addListener(map, 'idle', () => setViewVersion((v) => v + 1))
    return () => {
      // 인증 실패로 SDK가 비워졌으면 정리 호출도 예외를 던지므로 건너뜀
      if (!isSdkDisabled()) maps.Event.removeListener(listener)
    }
  }, [map])

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
    const view = readViewBounds(map)
    const isCompact = isCompactZoom(map)
    const isHidden = isHiddenZoom(map)

    stations.forEach((station) => {
      nextIds.add(station.stationId)
      // 너무 멀리 보면 화면 안이라도 그리지 않음
      const isVisible = !isHidden && isInView(station, view)
      const entry = entries.get(station.stationId)

      // 처음 보는 충전소면 마커를 새로 만듦. 화면 밖이면 들어올 때까지 미룸
      if (!entry) {
        if (!isVisible) return
        const marker = new maps.Marker({
          map,
          position: new maps.LatLng(station.lat, station.lng),
          title: station.name,
          icon: toMarkerIcon(station, isCompact),
        })
        const listener = maps.Event.addListener(marker, 'click', () => {
          const latest = entries.get(station.stationId)?.station ?? station
          // 색 점은 너무 작아 정확히 누르기 어려우므로 상세 대신 그 위치로 확대
          if (isCompactZoom(map)) {
            map.morph(new maps.LatLng(latest.lat, latest.lng), COMPACT_TAP_ZOOM)
            return
          }
          // 클릭 시점의 최신 충전소 정보를 넘기도록 목록에서 다시 꺼냄
          onSelectRef.current?.(latest)
        })
        entries.set(station.stationId, {
          marker,
          listener,
          station,
          key: toMarkerKey(station, isCompact),
          isOnMap: true,
        })
        return
      }

      // 화면 밖으로 나간 마커는 지도에서만 뗌. 아이콘 · 좌표는 다시 들어올 때 맞춤
      if (!isVisible) {
        if (entry.isOnMap) {
          entry.marker.setMap(null)
          entry.isOnMap = false
        }
        return
      }

      // 사용 가능 대수 · 혼잡도가 바뀌었거나 점 ↔ 숫자 경계를 넘은 마커만 아이콘을 새로 그림
      const key = toMarkerKey(station, isCompact)
      if (entry.key !== key) {
        entry.marker.setIcon(toMarkerIcon(station, isCompact))
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
      // 떼어 뒀던 마커가 화면에 다시 들어오면 지도에 붙임
      if (!entry.isOnMap) {
        entry.marker.setMap(map)
        entry.isOnMap = true
      }
    })

    // 새 목록에 없는 충전소(필터로 빠졌거나 대상에서 제외됨)는 마커를 지움
    entries.forEach((entry, stationId) => {
      if (nextIds.has(stationId)) return
      maps.Event.removeListener(entry.listener)
      if (entry.isOnMap) entry.marker.setMap(null)
      entries.delete(stationId)
    })
  }, [map, stations, viewVersion])

  // 지도 이동 · 확대가 끝날 때마다(viewVersion) 다시 그려지므로 그때의 줌으로 판단
  return { isZoomedOut: map ? isHiddenZoom(map) : false }
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
