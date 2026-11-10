import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import '@/styles/index.css'

/**
 * VITE_USE_MOCK 값에 따라 MSW 워커를 띄운다.
 * true = 전체 Mock / partial = 백엔드에 없는 API만 Mock / 그 외(false · 빈 값) = Mock 없이 실제 서버
 * 동적 import라서 Mock을 끄면 MSW 코드가 배포 번들에 포함되지 않는다.
 */
async function enableMocking() {
  const mode = import.meta.env.VITE_USE_MOCK
  // true · partial이 아니면 워커를 띄우지 않고 바로 끝냄 → 모든 요청이 실제 서버로 감
  if (mode !== 'true' && mode !== 'partial') return
  const { createWorker } = await import('@/mocks/browser')
  // 핸들러에 없는 요청은 경고 없이 실제 서버로 흘려보냄 (혼합 모드에서 충전소 · 휴게소 API가 여기에 해당)
  await createWorker(mode === 'partial' ? 'partial' : 'full').start({ onUnhandledFrame: 'bypass' })
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
