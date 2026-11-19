import { createElement, useEffect, useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StationMarker } from '@/components/StationMarker'
import myLocationIcon from '@/assets/my-location.svg'
import { createStationDotLayer, type StationDotLayer } from '@/lib/stationDotLayer'
import type { LatLng } from '@/types/geo'
import type { Station } from '@/types/station'

/**
 * 이 줌 이하에서는 숫자 대신 색 점(캔버스)으로 그림. 줌 13 ≈ 모바일 화면 가로 6km, 알약끼리 겹치기 시작함.
 * 마포(예측 · 추천 대상)는 이 구간에서도 숫자를 유지
 */
const DOT_MAX_ZOOM = 13
/** 점 사이에 섞인 마포 숫자 마커가 점에 가리지 않게 위로 올림 */
const MAPO_Z_INDEX = 1
/** 추천 충전소 마커는 겹쳐도 다른 마커에 가리지 않게 가장 위로 */
const RECOMMENDED_Z_INDEX = 2
/** 이 줌 이하에서는 마커를 숨김. 줌 11이면 서울 대부분이 화면에 들어와 1,600여 개를 모두 그리게 됨 */
const HIDDEN_MAX_ZOOM = 11
/** 색 점을 누르면 이 줌으로 확대해 숫자 마커를 보여 줌 (지도 첫 화면과 같은 줌) */
const DOT_TAP_ZOOM = 14
/** 누른 뒤 손가락이 이 거리(px) 넘게 움직였거나 이 시간(ms) 넘게 눌렀으면 탭이 아니라 끌기 · 길게 누르기로 봄 */
const TAP_MOVE_TOLERANCE = 8
const TAP_MAX_DURATION = 500

// 네이버 지도 마커는 HTML 문자열만 받으므로 React 컴포넌트를 정적 마크업으로 변환
function toMarkerHtml(station: Station, isRecommended: boolean) {
  return renderToStaticMarkup(
    createElement(StationMarker, {
      availableChargers: station.availableChargers,
      totalChargers: station.totalChargers,
      congestion: station.congestion,
      isRecommended,
    }),
  )
}

// 이 충전소를 HTML 숫자 마커 대신 캔버스 색 점으로 그릴지. 마포(predictionAvailable) · 추천은 점 구간에서도 숫자로 그림
function isDotStation(map: naver.maps.Map, station: Station, isRecommended: boolean) {
  return map.getZoom() <= DOT_MAX_ZOOM && !station.predictionAvailable && !isRecommended
}

// 마커 겹침 순서. 추천 > 마포 > 나머지
function toZIndex(station: Station, isRecommended: boolean) {
  // 추천이면 가장 위
  if (isRecommended) return RECOMMENDED_Z_INDEX
  return station.predictionAvailable ? MAPO_Z_INDEX : 0
}

function isHiddenZoom(map: naver.maps.Map) {
  return map.getZoom() <= HIDDEN_MAX_ZOOM
}

// 인증 실패 시 SDK가 naver.maps를 null로 비워 마커 정리 호출도 예외를 던짐 (지도는 안내 화면으로 가려짐)
function isSdkDisabled() {
  return !window.naver.maps
}

// 마커 모양을 정하는 값만 이어 붙인 키 - 키가 같으면 아이콘을 다시 만들지 않음
function toMarkerKey(station: Station, isRecommended: boolean) {
  return `${station.availableChargers}/${station.totalChargers}/${station.congestion}/${isRecommended}`
}

function toMarkerIcon(station: Station, isRecommended: boolean): naver.maps.HtmlIcon {
  return {
    content: `<div style="transform: translate(-50%, -50%)">${toMarkerHtml(station, isRecommended)}</div>`,
  }
}

type MarkerEntry = {
  marker: naver.maps.Marker
  listener: naver.maps.MapEventListener
  station: Station
  key: string
  /** 지금 보이는지. 화면 밖으로 나가면 숨겨 두고 다시 들어오면 재사용 */
  isShown: boolean
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
 * 서울 전역은 수천 곳이라 화면(+ 여유) 안의 충전소만 보이게 하고, 멀리 볼 때는 HTML 마커 대신
 * 캔버스 하나에 색 점으로 그리고(끄는 도중 버벅임 방지), 더 멀리 보면 숨김.
 * 숨겼는지(isZoomedOut)를 돌려줘 화면에서 확대 안내를 띄우게 함.
 * recommendedIds에 든 충전소(추천 Top 3)는 형광 파랑으로 그리고 다른 마커 위에 올림
 */
export function useStationMarkers(
  map: naver.maps.Map | null,
  stations: Station[] | undefined,
  onSelect?: (station: Station) => void,
  recommendedIds?: ReadonlySet<string>,
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

  // 색 점을 그릴 캔버스 레이어. 지도마다 하나
  const dotLayerRef = useRef<StationDotLayer | null>(null)
  useEffect(() => {
    // 지도가 아직 없으면(로딩 · 인증 실패) 만들지 않음
    if (!map) return
    const { maps } = window.naver
    const layer = createStationDotLayer()
    layer.setMap(map)
    dotLayerRef.current = layer

    // 점은 HTML 요소가 아니라서 누른 위치로 점을 찾음. 네이버 지도 click 이벤트는
    // 서비스 범위 다각형이 화면을 덮고 있어 오지 않으므로 지도 요소의 pointer 이벤트로 직접 탭을 판단함
    const element = map.getElement()
    let press: { x: number; y: number; time: number } | null = null
    const handlePointerDown = (event: PointerEvent) => {
      press = { x: event.clientX, y: event.clientY, time: event.timeStamp }
    }
    const handlePointerUp = (event: PointerEvent) => {
      const start = press
      press = null
      // 누른 기록이 없거나, 끌었거나, 오래 눌렀으면 탭이 아님
      if (
        !start ||
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_MOVE_TOLERANCE ||
        event.timeStamp - start.time > TAP_MAX_DURATION
      ) {
        return
      }
      // 숫자 마커를 누른 거면 마커 클릭(상세 열기)이 처리함
      if (event.target instanceof Element && event.target.closest('[data-station-marker]')) return
      const rect = element.getBoundingClientRect()
      const station = layer.findStationAtPoint(event.clientX - rect.left, event.clientY - rect.top)
      // 점은 작아 상세 대신 그 위치로 확대해 숫자 마커를 보여 줌
      if (station) map.morph(new maps.LatLng(station.lat, station.lng), DOT_TAP_ZOOM)
    }
    element.addEventListener('pointerdown', handlePointerDown)
    element.addEventListener('pointerup', handlePointerUp)

    return () => {
      dotLayerRef.current = null
      element.removeEventListener('pointerdown', handlePointerDown)
      element.removeEventListener('pointerup', handlePointerUp)
      // 인증 실패로 SDK가 비워졌으면 정리 호출도 예외를 던지므로 건너뜀
      if (!isSdkDisabled()) layer.setMap(null)
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
    const isHidden = isHiddenZoom(map)
    const dots: Station[] = []

    stations.forEach((station) => {
      nextIds.add(station.stationId)
      const isRecommended = recommendedIds?.has(station.stationId) ?? false
      // 너무 멀리 보면 화면 안이라도 그리지 않음
      const isInScreen = !isHidden && isInView(station, view)
      // 점으로 그릴 충전소는 캔버스로 넘기고 HTML 마커는 숨김
      const isDot = isInScreen && isDotStation(map, station, isRecommended)
      if (isDot) dots.push(station)
      const isVisible = isInScreen && !isDot
      const entry = entries.get(station.stationId)

      // 처음 보는 충전소면 마커를 새로 만듦. 화면 밖이면 들어올 때까지 미룸
      if (!entry) {
        if (!isVisible) return
        const marker = new maps.Marker({
          map,
          position: new maps.LatLng(station.lat, station.lng),
          title: station.name,
          icon: toMarkerIcon(station, isRecommended),
          zIndex: toZIndex(station, isRecommended),
        })
        // 클릭 시점의 최신 충전소 정보를 넘기도록 목록에서 다시 꺼냄
        const listener = maps.Event.addListener(marker, 'click', () => {
          const latest = entries.get(station.stationId)?.station ?? station
          onSelectRef.current?.(latest)
        })
        entries.set(station.stationId, {
          marker,
          listener,
          station,
          key: toMarkerKey(station, isRecommended),
          isShown: true,
        })
        return
      }

      // 화면 밖으로 나갔거나 점으로 바뀐 마커는 숨기기만 함. 지도에서 떼는(setMap(null)) 것보다 훨씬 빠름
      // 아이콘 · 좌표는 다시 보일 때 맞춤
      if (!isVisible) {
        if (entry.isShown) {
          entry.marker.setVisible(false)
          entry.isShown = false
        }
        return
      }

      // 사용 가능 대수 · 혼잡도 · 추천 여부가 바뀐 마커만 아이콘을 새로 그림
      const key = toMarkerKey(station, isRecommended)
      if (entry.key !== key) {
        entry.marker.setIcon(toMarkerIcon(station, isRecommended))
        // 추천이 되거나 빠지면 겹침 순서도 맞춰 줌
        entry.marker.setZIndex(toZIndex(station, isRecommended))
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
      // 숨겨 뒀던 마커가 화면에 다시 들어오면 다시 보이게 함
      if (!entry.isShown) {
        entry.marker.setVisible(true)
        entry.isShown = true
      }
    })

    // 새 목록에 없는 충전소(필터로 빠졌거나 대상에서 제외됨)는 마커를 지움
    entries.forEach((entry, stationId) => {
      if (nextIds.has(stationId)) return
      maps.Event.removeListener(entry.listener)
      entry.marker.setMap(null)
      entries.delete(stationId)
    })

    dotLayerRef.current?.setStations(dots)
  }, [map, stations, viewVersion, recommendedIds])

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
