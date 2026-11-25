import { setupWorker } from 'msw/browser'
import { handlers } from '@/mocks/handlers'

/** 모든 API를 Mock으로 답하는 MSW 워커를 만든다 (VITE_USE_MOCK=true) */
export function createWorker() {
  return setupWorker(...handlers)
}
