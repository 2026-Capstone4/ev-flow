import { NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map'
import { toZIndex } from '@ev-flow/core/lib/mapMarkers'
import { COLORS } from '@ev-flow/core/lib/theme'
import type { Station } from '@ev-flow/core/types/station'
import { memo } from 'react'
import { DOT_IMAGES, DOT_SIZE, PILL_IMAGES, PILL_SHADOW, type MarkerColor } from './markerImages'

/** 알약 그림이 있는 글자 수 범위. 벗어나면 가장 가까운 그림을 씀 */
const MIN_TEXT_LENGTH = 3
const MAX_TEXT_LENGTH = 7

/** 캡션 글자색. 웹 StationMarker와 같이 혼잡도 바탕엔 흰 글자, 추천엔 추천 글자색 */
const TEXT_COLOR: Record<MarkerColor, string> = {
  low: COLORS['text-on-brand'],
  medium: COLORS['text-on-brand'],
  high: COLORS['text-on-brand'],
  unknown: COLORS['text-on-brand'],
  unavailable: COLORS['text-on-brand'],
  recommended: COLORS['marker-recommended-text'],
}

/** 캡션 테두리(halo)를 바탕색과 같게 둬서 글자 둘레에 흰 테두리가 생기지 않게 함 */
const HALO_COLOR: Record<MarkerColor, string> = {
  low: COLORS['congestion-free'],
  medium: COLORS['congestion-normal'],
  high: COLORS['congestion-busy'],
  unknown: COLORS['congestion-unknown'],
  unavailable: COLORS['congestion-unavailable'],
  recommended: COLORS['marker-recommended'],
}

type StationMarkerProps = {
  station: Station
  isRecommended: boolean
  /** 숫자 대신 색 점으로 그릴지 (mapMarkers.isDotStation) */
  isDot: boolean
  /** 다른 마커와 겹치면 SDK가 숨기게 할지 (검증용 토글) */
  isHideCollided: boolean
  onTap: (station: Station) => void
}

/**
 * 충전소 마커 하나. SDK 마커 + 미리 만든 그림이라 지도 엔진이 그림 (화면 요소를 겹치지 않음)
 * 숫자("사용 가능/전체")는 SDK 캡션으로 알약 가운데에 얹음
 * memo로 감싸 폴링으로 목록이 새로 와도 모양이 같은 마커는 다시 그리지 않음
 */
export const StationMarker = memo(function StationMarker({
  station,
  isRecommended,
  isDot,
  isHideCollided,
  onTap,
}: StationMarkerProps) {
  const color: MarkerColor = isRecommended ? 'recommended' : station.congestion
  const zIndex = toZIndex(station, isRecommended)
  const position = { latitude: station.lat, longitude: station.lng }

  // 점이면 숫자 없이 색 점만
  if (isDot) {
    return (
      <NaverMapMarkerOverlay
        {...position}
        image={DOT_IMAGES[color]}
        width={DOT_SIZE}
        height={DOT_SIZE}
        anchor={{ x: 0.5, y: 0.5 }}
        zIndex={zIndex}
        // 겹친 점끼리는 SDK가 하나만 남김 (마포 · 추천은 점이 되지 않음)
        isHideCollidedMarkers={isHideCollided}
        onTap={() => onTap(station)}
      />
    )
  }

  const text = `${station.availableChargers}/${station.totalChargers}`
  const length = Math.min(Math.max(text.length, MIN_TEXT_LENGTH), MAX_TEXT_LENGTH)
  const pill = PILL_IMAGES[color][length]
  return (
    <NaverMapMarkerOverlay
      {...position}
      image={pill.image}
      // 그림에는 그림자 여백이 사방에 있어 그만큼 크게 잡음. 가운데가 알약 가운데라 anchor는 0.5
      width={pill.width + PILL_SHADOW * 2}
      height={pill.height + PILL_SHADOW * 2}
      anchor={{ x: 0.5, y: 0.5 }}
      caption={{
        text,
        align: 'Center',
        textSize: 13,
        color: TEXT_COLOR[color],
        haloColor: HALO_COLOR[color],
      }}
      zIndex={zIndex}
      // 마포 · 추천 마커(zIndex > 0)는 겹침 숨김에서 뺌. 켜면 서로 겹친 마커의 숫자 캡션까지 사라짐
      isHideCollidedMarkers={isHideCollided && zIndex === 0}
      onTap={() => onTap(station)}
    />
  )
})
