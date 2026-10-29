import { useEffect, useRef, useState } from 'react'
import { loadNaverMapScript, onNaverMapAuthFailure } from '@/lib/loadNaverMapScript'
import type { LatLng } from '@/types/geo'

type NaverMapStatus = 'loading' | 'ready' | 'error' | 'no-client-id'

type UseNaverMapOptions = {
  center: LatLng
  zoom?: number
}

export function useNaverMap({ center, zoom = 14 }: UseNaverMapOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<naver.maps.Map | null>(null)
  const clientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID
  const [status, setStatus] = useState<NaverMapStatus>(clientId ? 'loading' : 'no-client-id')

  // 초기 위치만 반영하고 이후 이동은 사용자 조작에 맡김
  const initialRef = useRef({ center, zoom })

  useEffect(() => {
    if (!clientId) return
    let instance: naver.maps.Map | null = null
    let isCancelled = false
    let isAuthFailed = false

    // 인증 실패는 지도가 이미 만들어진 뒤에 올 수 있으므로 안내 화면으로 전환.
    // SDK가 naver.maps를 null로 비워서 destroy()도 실패하므로 참조만 버림
    const unsubscribe = onNaverMapAuthFailure(() => {
      isAuthFailed = true
      instance = null
      setMap(null)
      setStatus('error')
    })

    loadNaverMapScript(clientId)
      .then((maps) => {
        if (isCancelled || isAuthFailed || !containerRef.current) return
        const { center, zoom } = initialRef.current
        instance = new maps.Map(containerRef.current, {
          center: new maps.LatLng(center.lat, center.lng),
          zoom,
          scaleControl: false,
          mapDataControl: false,
          // 하단 시트에 가리지 않도록 로고를 위로 이동 (로고는 가리면 안 됨)
          logoControlOptions: { position: maps.Position.TOP_RIGHT },
        })
        setMap(instance)
        setStatus('ready')
      })
      .catch(() => {
        if (!isCancelled) setStatus('error')
      })

    return () => {
      isCancelled = true
      unsubscribe()
      instance?.destroy()
      setMap(null)
    }
  }, [clientId])

  return { containerRef, map, status }
}
