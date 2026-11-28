import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_ONBOARDING_STORAGE_KEY, hasSeenOnboarding, markOnboardingSeen } from './onboarding'

const brokenStorage = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('onboarding', () => {
  beforeEach(() => localStorage.clear())

  it('처음에는 안 본 상태이고, 기록하면 본 상태가 됨', () => {
    expect(hasSeenOnboarding()).toBe(false)
    markOnboardingSeen()
    expect(hasSeenOnboarding()).toBe(true)
  })

  it('앱 키는 웹 키와 따로 기록함', () => {
    markOnboardingSeen()
    expect(hasSeenOnboarding(undefined, APP_ONBOARDING_STORAGE_KEY)).toBe(false)
    markOnboardingSeen(undefined, APP_ONBOARDING_STORAGE_KEY)
    expect(hasSeenOnboarding(undefined, APP_ONBOARDING_STORAGE_KEY)).toBe(true)
  })

  it('저장소를 쓸 수 없으면 에러 없이 안 본 상태로 봄', () => {
    expect(hasSeenOnboarding(brokenStorage)).toBe(false)
    expect(() => markOnboardingSeen(brokenStorage)).not.toThrow()
  })

  it('저장소가 없는 환경(앱)에서는 에러 없이 안 본 상태로 봄', () => {
    vi.stubGlobal('localStorage', undefined)
    try {
      expect(() => markOnboardingSeen()).not.toThrow()
      expect(hasSeenOnboarding()).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
