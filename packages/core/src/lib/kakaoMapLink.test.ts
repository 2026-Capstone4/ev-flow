import { describe, expect, it } from 'vitest'
import { getKakaoCarRouteUrl, getKakaoWebRouteUrl } from './kakaoMapLink'

const destination = { lat: 37.5559, lng: 126.9019, name: '망원동 충전소' }

describe('getKakaoCarRouteUrl', () => {
  it('iOS는 kakaomap URL, 도착지는 위도,경도 · 자동차 · 출발지는 넣지 않음', () => {
    const url = getKakaoCarRouteUrl(destination, 'ios')
    expect(url).toBe('kakaomap://route?ep=37.5559,126.9019&by=CAR')
    expect(url).not.toContain('sp=')
  })

  it('Android는 카카오맵 패키지를 지정한 intent URL', () => {
    const url = getKakaoCarRouteUrl(destination, 'android')
    expect(url.startsWith('intent://route?ep=37.5559,126.9019&by=CAR#Intent;')).toBe(true)
    expect(url).toContain('scheme=kakaomap')
    expect(url).toContain('package=net.daum.android.map')
  })

  it('PC는 카카오맵 웹 길찾기 주소', () => {
    expect(getKakaoCarRouteUrl(destination, 'other')).toBe(
      `https://map.kakao.com/link/to/${encodeURIComponent('망원동 충전소')},37.5559,126.9019`,
    )
  })
})

describe('getKakaoWebRouteUrl', () => {
  it('이름의 쉼표는 좌표와 섞이지 않게 띄어쓰기로 바꿈', () => {
    const url = getKakaoWebRouteUrl({ ...destination, name: '상암,DMC 충전소' })
    expect(url).toBe(
      `https://map.kakao.com/link/to/${encodeURIComponent('상암 DMC 충전소')},37.5559,126.9019`,
    )
  })
})
