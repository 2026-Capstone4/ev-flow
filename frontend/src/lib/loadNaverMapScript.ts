const SCRIPT_URL = 'https://oapi.map.naver.com/openapi/v3/maps.js'

let loading: Promise<typeof naver.maps> | null = null

declare global {
  interface Window {
    navermap_authFailure?: () => void
  }
}

/** 네이버 지도 SDK는 전역 객체라 script 태그를 한 번만 넣고 로드 완료 후에만 접근 가능 */
export function loadNaverMapScript(clientId: string) {
  if (window.naver?.maps) return Promise.resolve(window.naver.maps)
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    // 인증 실패는 onerror가 아니라 이 전역 콜백으로만 알 수 있음 (도메인 미등록 · 잘못된 키)
    window.navermap_authFailure = () => reject(new Error('네이버 지도 인증 실패'))

    const script = document.createElement('script')
    script.src = `${SCRIPT_URL}?ncpKeyId=${encodeURIComponent(clientId)}`
    script.async = true
    script.onload = () => resolve(window.naver.maps)
    script.onerror = () => {
      loading = null
      reject(new Error('네이버 지도 스크립트 로드 실패'))
    }
    document.head.appendChild(script)
  })
  return loading
}
