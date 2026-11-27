import { describe, expect, it } from 'vitest'
import {
  chargerRegionLabel,
  DISTRICT_OPTIONS,
  formatPercent,
  formatStatUpdated,
  isStale,
  SEOUL_DISTRICTS,
  toDistrictParam,
} from '@/lib/admin/common'
// 백엔드 구 코드표 원본 — 프론트 SEOUL_DISTRICTS가 어긋나지 않았는지 비교용
import backendAdminSchema from '../../../../backend/app/schemas/admin.py?raw'

const now = new Date('2026-11-14T14:10:00+09:00')

describe('formatPercent', () => {
  it('비율을 반올림한 퍼센트로 표기하고 값이 없으면 대시', () => {
    expect(formatPercent(0.072)).toBe('7%')
    expect(formatPercent(0.072, 1)).toBe('7.2%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(null)).toBe('—')
  })
})

describe('isStale', () => {
  it('20분 넘게 지났거나 시각이 없으면 true', () => {
    expect(isStale('2026-11-14T13:50:00+09:00', now)).toBe(false)
    expect(isStale('2026-11-14T13:49:00+09:00', now)).toBe(true)
    expect(isStale(null, now)).toBe(true)
  })
})

describe('formatStatUpdated', () => {
  const reference = new Date(2026, 10, 22, 14, 30)

  it('같은 날이면 시각만, 다른 날이면 날짜를 붙임', () => {
    expect(formatStatUpdated(new Date(2026, 10, 22, 9, 5), reference)).toBe('09:05')
    expect(formatStatUpdated(new Date(2026, 10, 20, 14, 5), reference)).toBe('11/20 14:05')
  })
})

describe('toDistrictParam', () => {
  it('도심(seoul)에서 구를 골랐을 때만 구 코드를 넘기고, 그 밖에는 빼서 지역 전체를 받음', () => {
    expect(toDistrictParam('seoul', '11680')).toBe('11680')
    expect(toDistrictParam('seoul', 'all')).toBeUndefined()
    // 휴게소 · 전체는 백엔드가 구를 받지 않아(422) 보내지 않음
    expect(toDistrictParam('service_area', 'C0')).toBeUndefined()
    expect(toDistrictParam('all', '11680')).toBeUndefined()
  })
})

describe('DISTRICT_OPTIONS', () => {
  it('도심은 서울 전체 + 서울 25개 구를 가나다순으로', () => {
    const labels = DISTRICT_OPTIONS.seoul.map((option) => option.label)
    expect(labels[0]).toBe('서울 전체')
    expect(labels).toHaveLength(26)
    expect(labels.slice(1, 4)).toEqual(['강남구', '강동구', '강북구'])
  })
})

describe('chargerRegionLabel', () => {
  it('도심은 구 이름, 구를 모르면 도심, 휴게소는 휴게소', () => {
    expect(chargerRegionLabel({ region: 'live', districtName: '강남구' })).toBe('강남구')
    expect(chargerRegionLabel({ region: 'live', districtName: null })).toBe('도심')
    expect(chargerRegionLabel({ region: 'service_area', districtName: null })).toBe('휴게소')
  })
})

describe('SEOUL_DISTRICTS', () => {
  it('백엔드 코드표(backend/app/schemas/admin.py)와 코드 · 이름이 같음', () => {
    // 한쪽만 바뀌면 고른 구가 422가 되거나 선택지에서 빠지므로 백엔드 원본을 읽어 비교
    const block = backendAdminSchema.match(/SEOUL_DISTRICTS = \{([\s\S]*?)\n\}/)?.[1] ?? ''
    const backend = Object.fromEntries(
      [...block.matchAll(/"(\d{5})": "([^"]+)"/g)].map(([, code, name]) => [code, name]),
    )
    expect(Object.keys(backend)).toHaveLength(25)
    expect(SEOUL_DISTRICTS).toEqual(backend)
  })
})
