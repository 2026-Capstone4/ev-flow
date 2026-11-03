import { describe, expect, it } from 'vitest'
import { detectPlatform, getNaverCarRouteUrl } from '@/lib/naverMapLink'

describe('detectPlatform', () => {
  it('UA로 Android · iOS · 그 외를 구분함', () => {
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; SM-S918N)')).toBe('android')
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('other')
  })
})

describe('getNaverCarRouteUrl', () => {
  const options = {
    destination: { lat: 37.5559, lng: 126.9019, name: '망원동 충전소' },
    appName: 'http://localhost:5173',
  }

  it('iOS는 nmap URL, 도착지 · appname을 인코딩해 넣고 출발지는 넣지 않음', () => {
    const url = getNaverCarRouteUrl(options, 'ios')!
    expect(url.startsWith('nmap://route/car?')).toBe(true)
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('dlat')).toBe('37.5559')
    expect(params.get('dname')).toBe('망원동 충전소')
    expect(params.get('appname')).toBe('http://localhost:5173')
    expect(params.has('slat')).toBe(false)
  })

  it('Android는 네이버 지도 패키지를 지정한 intent URL', () => {
    const url = getNaverCarRouteUrl(options, 'android')!
    expect(url.startsWith('intent://route/car?')).toBe(true)
    expect(url).toContain('scheme=nmap')
    expect(url).toContain('package=com.nhn.android.nmap')
  })

  it('PC는 앱을 열 수 없어 null', () => {
    expect(getNaverCarRouteUrl(options, 'other')).toBeNull()
  })
})
