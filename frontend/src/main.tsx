import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setApiBaseUrl } from '@ev-flow/core/api/client'
import { App } from '@/app/App'
import { API_BASE_URL } from '@/lib/config'
import { loadNaverMapScript } from '@/lib/loadNaverMapScript'
import '@/styles/index.css'

// 공용 API 클라이언트에 웹 API 주소를 넘김. 첫 요청(화면 그리기) 전에 해야 함
setApiBaseUrl(API_BASE_URL)

// 지도 SDK는 Mock 준비 · 화면 그리기와 상관없어서 기다리지 않고 바로 실행을 시작함. 운영자 화면은 지도를 안 써서 뺌
const naverMapClientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID
if (naverMapClientId && !window.location.pathname.startsWith('/admin')) {
  // 실패하면 지도 화면(useNaverMap)이 같은 함수를 다시 불러 안내 화면을 띄우므로 여기서는 넘어감
  loadNaverMapScript(naverMapClientId).catch(() => {})
}

/**
 * VITE_USE_MOCK 값에 따라 MSW 워커를 띄운다.
 * true = 전체 Mock / 그 외(false · 빈 값) = Mock 없이 실제 서버
 * 동적 import라서 Mock을 끄면 MSW 코드가 배포 번들에 포함되지 않는다.
 */
async function enableMocking() {
  const mode = import.meta.env.VITE_USE_MOCK
  // true가 아니면 워커를 띄우지 않고 바로 끝냄 → 모든 요청이 실제 서버로 감
  if (mode !== 'true') return
  const { createWorker } = await import('@/mocks/browser')
  // 핸들러에 없는 요청(지도 타일 등)은 경고 없이 그대로 흘려보냄
  await createWorker().start({ onUnhandledFrame: 'bypass' })
}

// 워커가 준비된 뒤에 렌더링 - 먼저 그리면 첫 요청이 Mock을 거치지 않고 나갈 수 있음
enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    // 개발 모드 전용 검사 (렌더·effect 이중 실행)
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
