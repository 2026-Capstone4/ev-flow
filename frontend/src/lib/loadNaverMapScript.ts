const SCRIPT_URL = 'https://oapi.map.naver.com/openapi/v3/maps.js'

// 동시에 여러 번 호출돼도(StrictMode 이중 effect 등) script 태그를 한 번만 넣도록 공유
let loading: Promise<typeof naver.maps> | null = null

let isAuthFailed = false
const authFailureListeners = new Set<() => void>()

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
    window.navermap_authFailure = () => {
      isAuthFailed = true
      authFailureListeners.forEach((listener) => listener())
      reject(new Error('네이버 지도 인증 실패'))
    }

    const script = document.createElement('script')
    script.src = `${SCRIPT_URL}?ncpKeyId=${encodeURIComponent(clientId)}`
    script.async = true
    script.onload = () => resolve(window.naver.maps)
    script.onerror = () => {
      // 실패한 Promise를 계속 돌려주지 않도록 비워서 다음 호출 때 재시도
      loading = null
      reject(new Error('네이버 지도 스크립트 로드 실패'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/**
 * 인증 실패 구독. 콜백이 onload보다 늦게(약 1초 뒤) 호출돼 Promise reject로는 알 수 없음.
 * 이미 실패했으면 즉시 호출하고, 구독 해제 함수를 반환
 */
export function onNaverMapAuthFailure(listener: () => void) {
  if (isAuthFailed) {
    listener()
    return () => {}
  }
  authFailureListeners.add(listener)
  return () => {
    authFailureListeners.delete(listener)
  }
}
