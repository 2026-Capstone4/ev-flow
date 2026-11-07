import { setupWorker } from 'msw/browser'
import { handlers, partialHandlers } from '@/mocks/handlers'

/**
 * 모드에 맞는 핸들러로 MSW 워커를 만든다.
 * full = 모든 API를 Mock으로 / partial = 추천 · 길찾기만 Mock, 나머지 요청은 실제 서버로 그대로 나감
 */
export function createWorker(mode: 'full' | 'partial') {
  return setupWorker(...(mode === 'partial' ? partialHandlers : handlers))
}
