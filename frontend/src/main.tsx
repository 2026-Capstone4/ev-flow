import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import '@/styles/index.css'

// VITE_USE_MOCK=true일 때만 MSW 워커를 띄운다.
// 동적 import라서 Mock을 끄면 MSW 코드가 배포 번들에 포함되지 않는다.
async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCK !== 'true') return
  const { worker } = await import('@/mocks/browser')
  await worker.start({ onUnhandledFrame: 'bypass' })
}

// 워커가 준비된 뒤에 렌더링
enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    // 개발 모드 전용 검사 (렌더·effect 이중 실행)
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
