import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  STATIONS_CACHE_KEY,
  STATIONS_CACHE_MAX_AGE_MS,
  loadStationsCache,
  saveStationsCache,
} from './stationsCache'
import type { StationsResponse } from '../types/station'

const UPDATED_AT = '2026-11-19T09:00:00+09:00'
const UPDATED_AT_MS = new Date(UPDATED_AT).getTime()

const response: StationsResponse = { updatedAt: UPDATED_AT, dataQuality: 'normal', stations: [] }

const brokenStorage = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('stationsCache', () => {
  beforeEach(() => localStorage.clear())

  it('저장한 목록을 그대로 돌려줌', () => {
    saveStationsCache(response)
    expect(loadStationsCache(UPDATED_AT_MS + 60_000)).toEqual(response)
  })

  it('저장한 적이 없으면 없음', () => {
    expect(loadStationsCache(UPDATED_AT_MS)).toBeUndefined()
  })

  it('오래된 목록은 버림', () => {
    saveStationsCache(response)
    expect(loadStationsCache(UPDATED_AT_MS + STATIONS_CACHE_MAX_AGE_MS + 1)).toBeUndefined()
  })

  it('깨졌거나 모양이 다른 값은 버림', () => {
    localStorage.setItem(STATIONS_CACHE_KEY, '{broken')
    expect(loadStationsCache(UPDATED_AT_MS)).toBeUndefined()
    localStorage.setItem(STATIONS_CACHE_KEY, JSON.stringify({ updatedAt: UPDATED_AT }))
    expect(loadStationsCache(UPDATED_AT_MS)).toBeUndefined()
    localStorage.setItem(STATIONS_CACHE_KEY, JSON.stringify({ ...response, updatedAt: 'x' }))
    expect(loadStationsCache(UPDATED_AT_MS)).toBeUndefined()
  })

  it('저장소를 쓸 수 없으면 에러 없이 넘어감', () => {
    expect(loadStationsCache(UPDATED_AT_MS, brokenStorage)).toBeUndefined()
    expect(() => saveStationsCache(response, brokenStorage)).not.toThrow()
  })

  it('저장소가 없는 환경(앱)에서는 저장값 없이 에러 없이 넘어감', () => {
    vi.stubGlobal('localStorage', undefined)
    try {
      expect(() => saveStationsCache(response)).not.toThrow()
      expect(loadStationsCache(UPDATED_AT_MS)).toBeUndefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
