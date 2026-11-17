import { useEffect, useState } from 'react'

type DevZoomBadgeProps = {
  map: naver.maps.Map | null
}

/** 개발 모드에서 지금 지도 줌을 보여 주는 표시. 마커 줌 기준(점 · 숨김)을 맞출 때 씀 */
export function DevZoomBadge({ map }: DevZoomBadgeProps) {
  // 줌이 바뀌기 전에는 지도에서 바로 읽고, 바뀐 뒤에는 이벤트로 받은 값을 씀
  const [changedZoom, setChangedZoom] = useState<number | null>(null)

  useEffect(() => {
    // 지도가 아직 없으면(로딩 · 인증 실패) 듣지 않음
    if (!map) return
    const { maps } = window.naver
    // 확대 · 축소 애니메이션 도중에도 단계가 바뀔 때마다 옴
    const listener = maps.Event.addListener(map, 'zoom_changed', (zoom: number) =>
      setChangedZoom(zoom),
    )
    return () => {
      // 인증 실패로 SDK가 비워졌으면 정리 호출도 예외를 던지므로 건너뜀
      if (window.naver.maps) maps.Event.removeListener(listener)
    }
  }, [map])

  // 지도가 없으면 줌을 알 수 없어서 아무것도 안 그림
  if (!map) return null
  const zoom = changedZoom ?? map.getZoom()

  return (
    <span className="pointer-events-none rounded-md bg-black/60 px-2 py-1 font-mono text-xs font-semibold text-white">
      줌 {zoom}
    </span>
  )
}
