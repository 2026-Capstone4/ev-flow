import { describe, expect, it } from 'vitest'
import { parseDemoLocation } from './demoLocation'

describe('parseDemoLocation', () => {
  it('마포구 안 "위도,경도"는 좌표로 바꿈 (앞뒤 공백 허용)', () => {
    expect(parseDemoLocation('37.5535,126.9135')).toEqual({ lat: 37.5535, lng: 126.9135 })
    expect(parseDemoLocation(' 37.5663 , 126.9019 ')).toEqual({ lat: 37.5663, lng: 126.9019 })
  })

  it('값이 없거나 비어 있으면 null', () => {
    expect(parseDemoLocation(undefined)).toBeNull()
    expect(parseDemoLocation('')).toBeNull()
    expect(parseDemoLocation('  ')).toBeNull()
  })

  it('숫자 두 개가 아니면 null', () => {
    expect(parseDemoLocation('37.5535')).toBeNull()
    expect(parseDemoLocation('37.5535,126.9135,0')).toBeNull()
    expect(parseDemoLocation('합정역')).toBeNull()
    expect(parseDemoLocation('37.5535,')).toBeNull()
  })

  it('마포구 밖(강남역)이면 null', () => {
    expect(parseDemoLocation('37.4979,127.0276')).toBeNull()
  })
})
