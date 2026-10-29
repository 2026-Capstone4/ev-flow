import { describe, expect, it } from 'vitest'
import { getListLoadState } from '@/lib/loadState'

describe('getListLoadState', () => {
  it('데이터가 없으면 에러 여부로 로딩 · 에러를 구분함', () => {
    expect(getListLoadState(undefined, false)).toBe('loading')
    expect(getListLoadState(undefined, true)).toBe('error')
  })

  it('빈 배열이면 empty', () => {
    expect(getListLoadState([], false)).toBe('empty')
  })

  it('마지막 정상값이 있으면 갱신 실패여도 ready', () => {
    expect(getListLoadState([1], true)).toBe('ready')
  })
})
