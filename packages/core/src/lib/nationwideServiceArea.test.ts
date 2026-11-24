import { describe, expect, it } from 'vitest'
import {
  excludeDuplicateRegistrations,
  getRouteAreas,
  getRouteHeadings,
  getRouteLabel,
  getTowardsNote,
  isDuplicateRegistrationArea,
  searchServiceAreas,
  summarizeRoutes,
} from './nationwideServiceArea'
import type { NationwideServiceArea, ServiceAreaCharger } from '../types/serviceArea'

/** 테스트용 휴게소. 필요한 값만 바꿔 씀 */
function area(overrides: Partial<NationwideServiceArea>): NationwideServiceArea {
  return {
    id: 'X',
    name: 'X휴게소',
    shortName: 'X휴게소',
    routeName: '경부선',
    routeNo: '1',
    heading: null,
    towards: null,
    bidirectional: false,
    routeSeq: null,
    seqOrder: null,
    address: null,
    regionCode: '44',
    regionName: '충청남도',
    lat: 36,
    lng: 127,
    totalChargers: 4,
    availableChargers: 2,
    statusCounts: { available: 2, charging: 2, stopped: 0, maintenance: 0, unknown: 0 },
    dataQuality: 'normal',
    ...overrides,
  }
}

// 경부선: 순서 번호는 부산 쪽이 작고 서울 쪽이 큼 (실제 응답과 같음)
const GYEONGBU = [
  area({ id: '양산(서울)', heading: '서울', towards: '서울', routeSeq: 1, seqOrder: 'asc' }),
  area({ id: '양산(부산)', heading: '부산', towards: '부산', routeSeq: 1, seqOrder: 'desc' }),
  area({ id: '천안호두(부산)', heading: '부산', towards: '부산', routeSeq: 12, seqOrder: 'desc' }),
  area({ id: '옥천만남', bidirectional: true, routeSeq: 5 }),
  area({ id: '기흥(서울)', heading: '서울', towards: '서울', routeSeq: 20, seqOrder: 'asc' }),
]

describe('getRouteLabel', () => {
  it('노선 이름 끝의 선만 뺌', () => {
    expect(getRouteLabel('경부선')).toBe('경부')
    expect(getRouteLabel('수도권제1순환선')).toBe('수도권제1순환')
  })
})

describe('getRouteHeadings', () => {
  it('순서 번호가 작은 쪽 끝(desc 방향) → 큰 쪽 끝(asc 방향) 순서', () => {
    expect(getRouteHeadings(GYEONGBU, '경부선')).toEqual(['부산', '서울'])
  })

  it('방향 버튼이 없는 노선(순환선)은 빈 배열', () => {
    const ring = [
      area({ id: '시흥하늘', routeName: '수도권제1순환선', bidirectional: true }),
      area({ id: '구리(일산)', routeName: '수도권제1순환선', towards: '일산' }),
    ]
    expect(getRouteHeadings(ring, '수도권제1순환선')).toEqual([])
  })
})

describe('summarizeRoutes', () => {
  it('노선별로 두 방향을 합쳐 세고, 노선 번호순으로 놓음. 노선 미확인은 빠짐', () => {
    const routes = summarizeRoutes([
      area({ id: '덕평', routeName: '영동선', routeNo: '50', bidirectional: true }),
      ...GYEONGBU,
      area({ id: 'ME000001', routeName: null, routeNo: null }),
    ])
    expect(routes.map((r) => r.routeName)).toEqual(['경부선', '영동선'])
    expect(routes[0]).toMatchObject({
      label: '경부',
      routeNo: '1',
      ends: ['부산', '서울'],
      areaCount: 5,
      totalChargers: 20,
      availableChargers: 10,
    })
    // 양방향 휴게소 하나뿐이라 방향 버튼이 없음
    expect(routes[1].ends).toBeNull()
  })

  it('번호가 같은 노선은 이름순', () => {
    const routes = summarizeRoutes([
      area({ routeName: '중부선', routeNo: '35' }),
      area({ routeName: '대전통영선', routeNo: '35' }),
    ])
    expect(routes.map((r) => r.routeName)).toEqual(['대전통영선', '중부선'])
  })
})

describe('getRouteAreas', () => {
  it('부산 방향(desc)은 순서 번호가 큰 쪽부터, 양방향 휴게소도 넣음', () => {
    expect(getRouteAreas(GYEONGBU, '경부선', '부산').map((a) => a.id)).toEqual([
      '천안호두(부산)',
      '옥천만남',
      '양산(부산)',
    ])
  })

  it('서울 방향(asc)은 순서 번호가 작은 쪽부터', () => {
    expect(getRouteAreas(GYEONGBU, '경부선', '서울').map((a) => a.id)).toEqual([
      '양산(서울)',
      '옥천만남',
      '기흥(서울)',
    ])
  })

  it('방향이 없으면 노선 전체를 순서 번호가 작은 쪽부터', () => {
    expect(getRouteAreas(GYEONGBU, '경부선', null)).toHaveLength(5)
  })
})

describe('getTowardsNote', () => {
  it('표지판 방향이 고른 방향과 다를 때만 붙임', () => {
    const gongju = area({ heading: '영덕', towards: '대전' })
    expect(getTowardsNote(gongju, '영덕')).toBe('대전 방향')
    expect(getTowardsNote(area({ heading: '영덕', towards: '영덕' }), '영덕')).toBeNull()
  })

  it('양방향 휴게소 · 방향 탭이 없는 노선은 붙이지 않음', () => {
    expect(getTowardsNote(area({ bidirectional: true, towards: '대전' }), '영덕')).toBeNull()
    expect(getTowardsNote(area({ towards: '일산' }), null)).toBeNull()
  })
})

describe('excludeDuplicateRegistrations', () => {
  const charger = (
    stationId: string,
    chargerId: string,
    status: ServiceAreaCharger['status'],
    capacityKw = 260,
  ): ServiceAreaCharger => ({
    stationId,
    operator: stationId.startsWith('HY') ? '현대엔지니어링' : '현대자동차',
    chargerId,
    status,
    connectorTypes: ['dc_combo'],
    capacityKw,
    chargingStartedAt: null,
  })

  it('똑같은 충전기 묶음(HD)이 있고 모두 확인 불가인 HY 충전소는 뺌', () => {
    const result = excludeDuplicateRegistrations([
      charger('HD000002', '01', 'available', 100),
      charger('HD000002', '02', 'charging'),
      charger('HY001965', '01', 'unknown', 100),
      charger('HY001965', '02', 'unknown'),
      charger('ME20A403', '01', 'unknown'),
    ])
    expect(result.map((c) => c.stationId)).toEqual(['HD000002', 'HD000002', 'ME20A403'])
  })

  it('상태가 들어오는 HY · 짝이 없는 HY는 남김 (양평 용문 HY000160)', () => {
    const chargers = [
      charger('HY000160', '01', 'available', 100),
      charger('HY000160', '02', 'available', 100),
      charger('HY002005', '01', 'unknown'),
    ]
    expect(excludeDuplicateRegistrations(chargers)).toEqual(chargers)
  })
})

describe('isDuplicateRegistrationArea', () => {
  const unknownAll = { available: 0, charging: 0, stopped: 0, maintenance: 0, unknown: 6 }

  it('노선 미확인 HY 충전소 중 모두 확인 불가인 곳만', () => {
    const hy = area({ id: 'HY002005', routeName: null, totalChargers: 6, statusCounts: unknownAll })
    expect(isDuplicateRegistrationArea(hy)).toBe(true)
    // 상태가 들어오는 HY(양평 용문) · HY가 아닌 곳은 숨기지 않음
    expect(isDuplicateRegistrationArea(area({ id: 'HY000160', routeName: null }))).toBe(false)
    expect(
      isDuplicateRegistrationArea(
        area({ id: 'HD000042', routeName: null, totalChargers: 6, statusCounts: unknownAll }),
      ),
    ).toBe(false)
  })
})

describe('searchServiceAreas', () => {
  const areas = [
    area({ id: '천안호두(부산)', name: '천안호두휴게소 (부산 방향)', regionName: '충청남도' }),
    area({
      id: '덕평',
      name: '덕평휴게소',
      routeName: '영동선',
      regionName: '경기도',
      address: '경기도 이천시 마장면',
    }),
    area({
      id: 'HY002005',
      name: '가평휴게소(서울방향)',
      routeName: null,
      totalChargers: 6,
      statusCounts: { available: 0, charging: 0, stopped: 0, maintenance: 0, unknown: 6 },
    }),
  ]

  it('이름 · 노선 · 시도 · 주소에서 띄어쓰기 없이 찾음', () => {
    expect(searchServiceAreas(areas, '천안 호두').map((a) => a.id)).toEqual(['천안호두(부산)'])
    expect(searchServiceAreas(areas, '경부').map((a) => a.id)).toEqual(['천안호두(부산)'])
    expect(searchServiceAreas(areas, '이천').map((a) => a.id)).toEqual(['덕평'])
    expect(searchServiceAreas(areas, '경기').map((a) => a.id)).toEqual(['덕평'])
  })

  it('검색어가 비면 빈 배열, 이중 등록 휴게소는 빼고 찾음', () => {
    expect(searchServiceAreas(areas, '  ')).toEqual([])
    expect(searchServiceAreas(areas, '가평')).toEqual([])
  })
})
