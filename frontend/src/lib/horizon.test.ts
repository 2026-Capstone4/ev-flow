import { describe, expect, it } from 'vitest'
import { parseHorizon } from '@/lib/horizon'

describe('parseHorizon', () => {
  it('15 · 30만 받음', () => {
    expect(parseHorizon('15')).toBe(15)
    expect(parseHorizon('30')).toBe(30)
  })

  it('없거나 잘못된 값이면 기본값 30', () => {
    expect(parseHorizon(null)).toBe(30)
    expect(parseHorizon('45')).toBe(30)
    expect(parseHorizon('abc')).toBe(30)
  })

  it('서비스에서 뺀 60분은 기본값 30', () => {
    expect(parseHorizon('60')).toBe(30)
  })
})
