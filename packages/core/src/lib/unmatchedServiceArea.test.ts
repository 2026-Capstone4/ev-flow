import { describe, expect, it } from 'vitest'
import { getRegionSections, getUnmatchedSections, summarizeRegions } from './serviceAreaRegion'
import {
  getMergedAreaName,
  parseUnmatchedName,
  splitAreaIds,
  toDisplayAreas,
} from './unmatchedServiceArea'
import type { NationwideServiceArea } from '../types/serviceArea'

/** 테스트용 휴게소. 기본은 노선 미확인 · 경기 */
function area(overrides: Partial<NationwideServiceArea>): NationwideServiceArea {
  return {
    id: 'X',
    name: 'X휴게소',
    shortName: 'X휴게소',
    routeName: null,
    routeNo: null,
    heading: null,
    towards: null,
    bidirectional: false,
    routeSeq: null,
    seqOrder: null,
    address: '경기도 어딘가',
    regionCode: '41',
    regionName: '경기도',
    lat: 37,
    lng: 127,
    totalChargers: 2,
    availableChargers: 1,
    statusCounts: { available: 1, charging: 1, stopped: 0, maintenance: 0, unknown: 0 },
    dataQuality: 'normal',
    ...overrides,
  }
}

describe('parseUnmatchedName', () => {
  it('괄호 · 방향 · 상행선 표기를 휴게소명과 방향으로 나눔', () => {
    expect(parseUnmatchedName('오산(과천) 휴게소')).toEqual({
      key: '오산',
      label: '오산',
      direction: '과천',
    })
    expect(parseUnmatchedName('송산포도휴게소(시흥방향)').direction).toBe('시흥')
    expect(parseUnmatchedName('예산예당호휴게소 익산방향')).toMatchObject({
      key: '예산예당호',
      direction: '익산',
    })
    expect(parseUnmatchedName('경기광주휴게소 상행선').direction).toBe('상행')
    expect(parseUnmatchedName('낙동강구미휴게소 (상행)').direction).toBe('상행')
    expect(parseUnmatchedName('서하남 간이 휴게소 (판교)')).toMatchObject({
      key: '서하남',
      direction: '판교',
    })
    expect(parseUnmatchedName('안산 시화나래휴게소')).toEqual({
      key: '안산시화나래',
      label: '안산 시화나래',
      direction: null,
    })
  })

  it('같은 쪽을 다른 도시로 적은 휴게소는 대표 표기로 맞춤', () => {
    expect(parseUnmatchedName('삼국유사 군위(서울) 휴게소').direction).toBe('상주')
  })
})

describe('toDisplayAreas', () => {
  it('방향 표기가 같은 노선 미확인 충전소를 한 곳으로 묶고 충전기 수를 더함', () => {
    const result = toDisplayAreas([
      area({ id: 'ME1', name: '오산(과천) 휴게소', totalChargers: 1, availableChargers: 1 }),
      area({ id: 'ME2', name: '오산(과천)휴게소', totalChargers: 2, availableChargers: 0 }),
      area({ id: 'ME3', name: '오산(동탄) 휴게소' }),
    ])
    expect(result.map((a) => [a.id, a.name, a.totalChargers, a.availableChargers])).toEqual([
      ['ME1,ME2', '오산휴게소 (과천 방향)', 3, 1],
      ['ME3', '오산휴게소 (동탄 방향)', 2, 1],
    ])
  })

  it('상행 · 방향 없음은 주소가 같은 도시 방향에 합치고, 도시 방향끼리는 주소가 같아도 따로', () => {
    const result = toDisplayAreas([
      area({ id: 'A', name: '군위영천휴게소 (영천)', address: '같은 주소' }),
      area({ id: 'B', name: '군위영천휴게소(하행)', address: '같은 주소' }),
      area({ id: 'C', name: '송산포도(시흥) 휴게소', address: '송산' }),
      area({ id: 'D', name: '송산포도(평택) 휴게소', address: '송산' }),
      area({ id: 'E', name: '경기광주휴게소 상행선', address: '상행 주소' }),
      area({ id: 'F', name: '경기광주휴게소 하행선', address: '하행 주소' }),
    ])
    expect(result.map((a) => a.name)).toEqual([
      '경기광주휴게소 (상행)',
      '경기광주휴게소 (하행)',
      '군위영천휴게소 (영천 방향)',
      '송산포도휴게소 (시흥 방향)',
      '송산포도휴게소 (평택 방향)',
    ])
  })

  it('노선이 붙은 휴게소는 그대로 앞에, 이중 등록(HY)은 뺌', () => {
    const result = toDisplayAreas([
      area({
        id: 'HY002007',
        name: '안산 시화나래휴게소',
        statusCounts: { available: 0, charging: 0, stopped: 0, maintenance: 0, unknown: 2 },
      }),
      area({ id: 'HD000044', name: '안산 시화나래휴게소' }),
      area({ id: '기흥(부산)', name: '기흥휴게소 (부산 방향)', routeName: '경부선', routeNo: '1' }),
    ])
    expect(result.map((a) => a.id)).toEqual(['기흥(부산)', 'HD000044'])
  })
})

describe('splitAreaIds · getMergedAreaName', () => {
  it('묶은 id를 나누고, 이름은 도시 방향이 있는 쪽으로 다시 만듦', () => {
    expect(splitAreaIds('ST600400,ME178137')).toEqual(['ST600400', 'ME178137'])
    expect(splitAreaIds('기흥(부산)')).toEqual(['기흥(부산)'])
    expect(getMergedAreaName(['군위영천휴게소(하행)', '군위영천휴게소 (영천)'])).toBe(
      '군위영천휴게소 (영천 방향)',
    )
    expect(getMergedAreaName(['기흥휴게소 (부산 방향)'])).toBe('기흥휴게소 (부산 방향)')
  })
})

describe('summarizeRegions · getRegionSections · getUnmatchedSections', () => {
  const areas = [
    area({ id: '덕평', name: '덕평휴게소', routeName: '영동선', routeNo: '50', routeSeq: 4 }),
    area({
      id: '기흥(부산)',
      name: '기흥휴게소 (부산 방향)',
      routeName: '경부선',
      routeNo: '1',
      routeSeq: 30,
    }),
    area({
      id: '기흥(서울)',
      name: '기흥휴게소 (서울 방향)',
      routeName: '경부선',
      routeNo: '1',
      routeSeq: 30,
    }),
    area({ id: '별내', name: '별내휴게소' }),
    area({
      id: '천안',
      name: '천안호두휴게소',
      routeName: '경부선',
      routeNo: '1',
      regionCode: '44',
      regionName: '충청남도',
    }),
    area({ id: '이상', name: '이상한휴게소', regionCode: '99', regionName: null }),
  ]

  it('시도는 수도권 → 충청 순, 표에 없는 코드는 기타로 맨 뒤', () => {
    expect(summarizeRegions(areas).map((r) => [r.label, r.name, r.areaCount])).toEqual([
      ['경기', '경기도', 4],
      ['충남', '충청남도', 1],
      ['기타', '기타', 1],
    ])
  })

  it('한 시도 안은 노선 번호순, 노선 안은 길 순서 · 이름순, 노선 미확인은 맨 아래', () => {
    const sections = getRegionSections(areas, '41')
    expect(sections.map((s) => s.title)).toEqual(['경부', '영동', '노선 미확인'])
    expect(sections[0].areas.map((a) => a.id)).toEqual(['기흥(부산)', '기흥(서울)'])
  })

  it('노선 미확인 화면은 시도별 소제목', () => {
    expect(getUnmatchedSections(areas).map((s) => [s.title, s.areas.length])).toEqual([
      ['경기', 1],
      ['기타', 1],
    ])
  })
})
