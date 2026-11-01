import { describe, expect, it, vi } from 'vitest'
import { loadNaverMapScript, onNaverMapAuthFailure } from '@/lib/loadNaverMapScript'

describe('onNaverMapAuthFailure', () => {
  it('인증 실패 시 구독자에게 알리고, 실패 이후 구독하면 즉시 호출함', () => {
    loadNaverMapScript('test-key').catch(() => {})
    const before = vi.fn()
    const unsubscribed = vi.fn()
    onNaverMapAuthFailure(before)
    onNaverMapAuthFailure(unsubscribed)()

    window.navermap_authFailure?.()

    expect(before).toHaveBeenCalledOnce()
    expect(unsubscribed).not.toHaveBeenCalled()

    const after = vi.fn()
    onNaverMapAuthFailure(after)
    expect(after).toHaveBeenCalledOnce()
  })
})
