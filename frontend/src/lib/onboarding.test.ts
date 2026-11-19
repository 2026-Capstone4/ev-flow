import { beforeEach, describe, expect, it } from 'vitest'
import { hasSeenOnboarding, markOnboardingSeen } from '@/lib/onboarding'

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

  it('저장소를 쓸 수 없으면 에러 없이 안 본 상태로 봄', () => {
    expect(hasSeenOnboarding(brokenStorage)).toBe(false)
    expect(() => markOnboardingSeen(brokenStorage)).not.toThrow()
  })
})
