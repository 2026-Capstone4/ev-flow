import { describe, expect, it } from 'vitest'
import { getLoginErrorMessage } from '@/lib/admin/auth'

describe('getLoginErrorMessage', () => {
  it('잠금은 Retry-After를 초 · 분으로 안내함', () => {
    expect(getLoginErrorMessage('LOGIN_LOCKED', 45)).toContain('45초 후')
    expect(getLoginErrorMessage('LOGIN_LOCKED', 90)).toContain('2분 후')
    expect(getLoginErrorMessage('LOGIN_LOCKED', null)).toContain('잠시 후')
  })

  it('알 수 없는 오류 · 네트워크 오류는 다시 시도 안내', () => {
    expect(getLoginErrorMessage(null, null)).toContain('잠시 후 다시 시도')
    expect(getLoginErrorMessage('INVALID_CREDENTIALS', null)).toContain('올바르지 않습니다')
  })
})
