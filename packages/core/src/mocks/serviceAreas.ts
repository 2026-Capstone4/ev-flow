import { toKstIso } from './stations'
import type {
  NationwideServiceArea,
  NationwideServiceAreaSummary,
  ServiceAreaCharger,
} from '../types/serviceArea'
import type { ChargerStatus, ConnectorType } from '../types/station'

// 전국 휴게소 (15 · 16번) Mock
// 웹 전체 Mock 모드(VITE_USE_MOCK=true)에서 노선별 · 지역별 · 상세 화면을 확인하려고 둔 예시. 이름 · 좌표는 대략값
// 노선 화면 방향 버튼(경부 서울 · 부산 방향), 방향 버튼 없는 순환선, 노선 미확인 묶기(가평), HY 이중 등록 숨기기를 확인할 수 있게 고름

type MockNationwideArea = Omit<
  NationwideServiceAreaSummary,
  'totalChargers' | 'availableChargers'
> & { chargers: Omit<ServiceAreaCharger, 'chargingStartedAt'>[] }

function charger(
  stationId: string,
  operator: string,
  chargerId: string,
  status: ChargerStatus,
  connectorTypes: ConnectorType[] = ['dc_combo'],
  capacityKw = 100,
) {
  return { stationId, operator, chargerId, status, connectorTypes, capacityKw }
}

function countStatus(chargers: MockNationwideArea['chargers']) {
  const counts: Record<ChargerStatus, number> = {
    available: 0,
    charging: 0,
    stopped: 0,
    maintenance: 0,
    unknown: 0,
  }
  chargers.forEach((c) => counts[c.status]++)
  return counts
}

/** 노선이 붙은 휴게소 한 곳. id는 서버처럼 '휴게소명(방향)', name · shortName은 id에서 만듦 */
function routeArea(
  base: string,
  towards: string | null,
  route: Pick<NationwideServiceArea, 'routeName' | 'routeNo' | 'heading' | 'routeSeq' | 'seqOrder'>,
  place: Pick<NationwideServiceArea, 'address' | 'regionCode' | 'regionName' | 'lat' | 'lng'>,
  chargers: MockNationwideArea['chargers'],
): MockNationwideArea {
  const shortName = `${base}휴게소`
  return {
    id: towards ? `${base}(${towards})` : base,
    name: towards ? `${shortName} (${towards} 방향)` : shortName,
    shortName,
    towards,
    bidirectional: towards === null,
    ...route,
    ...place,
    chargers,
  }
}

/** 노선을 못 붙인 휴게소 한 곳. 서버처럼 id는 statId, 이름은 원본 그대로 */
function unmatchedArea(
  id: string,
  name: string,
  place: Pick<NationwideServiceArea, 'address' | 'regionCode' | 'regionName' | 'lat' | 'lng'>,
  chargers: MockNationwideArea['chargers'],
): MockNationwideArea {
  return {
    id,
    name,
    shortName: name,
    routeName: null,
    routeNo: null,
    heading: null,
    towards: null,
    bidirectional: false,
    routeSeq: null,
    seqOrder: null,
    ...place,
    chargers,
  }
}

const GYEONGBU = { routeName: '경부선', routeNo: '1' }
const RING = { routeName: '수도권제1순환선', routeNo: '100', heading: null, seqOrder: null }

const MOCK_NATIONWIDE_AREAS: MockNationwideArea[] = [
  routeArea(
    '기흥',
    '부산',
    { ...GYEONGBU, heading: '부산', routeSeq: 30, seqOrder: 'desc' },
    {
      address: '경기도 용인시 기흥구 공세동',
      regionCode: '41',
      regionName: '경기도',
      lat: 37.2386,
      lng: 127.1003,
    },
    [
      charger('MOCKNW01', '한국도로공사', '01', 'available'),
      charger('MOCKNW01', '한국도로공사', '02', 'available'),
      charger('MOCKNW02', '현대자동차', '01', 'charging', ['dc_combo'], 260),
    ],
  ),
  routeArea(
    '기흥',
    '서울',
    { ...GYEONGBU, heading: '서울', routeSeq: 31, seqOrder: 'asc' },
    {
      address: '경기도 용인시 기흥구 공세동',
      regionCode: '41',
      regionName: '경기도',
      lat: 37.2395,
      lng: 127.1015,
    },
    [
      charger('MOCKNW03', '한국도로공사', '01', 'charging'),
      charger('MOCKNW03', '한국도로공사', '02', 'available'),
    ],
  ),
  routeArea(
    '천안삼거리',
    '서울',
    { ...GYEONGBU, heading: '서울', routeSeq: 25, seqOrder: 'asc' },
    {
      address: '충청남도 천안시 동남구 삼룡동',
      regionCode: '44',
      regionName: '충청남도',
      lat: 36.7913,
      lng: 127.1757,
    },
    [
      charger('MOCKNW04', '한국도로공사', '01', 'charging'),
      charger('MOCKNW04', '한국도로공사', '02', 'charging'),
    ],
  ),
  routeArea(
    '망향',
    '부산',
    { ...GYEONGBU, heading: '부산', routeSeq: 26, seqOrder: 'desc' },
    {
      address: '충청남도 천안시 서북구 성거읍 돌다리길 23-37',
      regionCode: '44',
      regionName: '충청남도',
      lat: 36.8541795,
      lng: 127.1804275,
    },
    [
      charger('MOCKNW05', '한국도로공사', '01', 'available'),
      charger('MOCKNW05', '한국도로공사', '02', 'charging'),
      charger('MOCKNW06', 'SK일렉링크', '01', 'available', ['dc_combo'], 200),
      charger('MOCKNW06', 'SK일렉링크', '02', 'maintenance', ['dc_combo'], 200),
    ],
  ),
  routeArea(
    '시흥하늘',
    null,
    { ...RING, routeSeq: 5 },
    {
      address: '경기도 시흥시 장현동',
      regionCode: '41',
      regionName: '경기도',
      lat: 37.3752,
      lng: 126.8249,
    },
    [
      charger('MOCKNW07', '한국도로공사', '01', 'available'),
      charger('MOCKNW07', '한국도로공사', '02', 'unknown'),
    ],
  ),
  // 같은 휴게소가 운영기관마다 이름 표기를 달리해 두 줄로 옴 → 화면에서 한 줄로 묶임
  unmatchedArea(
    'ME22A309',
    '가평(서울)휴게소',
    {
      address: '경기도 가평군 설악면 미사리로 544',
      regionCode: '41',
      regionName: '경기도',
      lat: 37.7004,
      lng: 127.5437,
    },
    [
      charger('ME22A309', '환경부', '01', 'charging'),
      charger('ME22A309', '환경부', '02', 'available'),
    ],
  ),
  unmatchedArea(
    'HD000042',
    '가평휴게소(서울방향)',
    {
      address: '경기도 가평군 설악면 미사리로 544',
      regionCode: '41',
      regionName: '경기도',
      lat: 37.7004,
      lng: 127.5437,
    },
    [
      charger('HD000042', '현대자동차', '01', 'available', ['dc_combo'], 260),
      charger('HD000042', '현대자동차', '02', 'available', ['dc_combo'], 260),
    ],
  ),
  // HD 충전소를 한 번 더 등록한 HY 충전소 - 충전기가 모두 확인 불가라 목록에서 숨겨짐
  unmatchedArea(
    'HY000042',
    '가평휴게소(서울방향)',
    {
      address: '경기도 가평군 설악면 미사리로 544',
      regionCode: '41',
      regionName: '경기도',
      lat: 37.7004,
      lng: 127.5437,
    },
    [
      charger('HY000042', '현대엔지니어링', '01', 'unknown', ['dc_combo'], 260),
      charger('HY000042', '현대엔지니어링', '02', 'unknown', ['dc_combo'], 260),
    ],
  ),
  unmatchedArea(
    'KP005600',
    '거제대교 휴게소',
    {
      address: '경상남도 거제시 사등면',
      regionCode: '48',
      regionName: '경상남도',
      lat: 34.9007,
      lng: 128.4802,
    },
    [
      charger('KP005600', '한국전력', '01', 'available'),
      charger('KP005600', '한국전력', '02', 'charging'),
    ],
  ),
]

/** 목록 · 상세 응답에 같이 들어가는 휴게소 요약. 충전기 수는 Mock 충전기에서 셈 */
function toNationwideSummary({ chargers, ...area }: MockNationwideArea) {
  return {
    ...area,
    totalChargers: chargers.length,
    availableChargers: chargers.filter((c) => c.status === 'available').length,
  }
}

function toNationwideArea(area: MockNationwideArea): NationwideServiceArea {
  return {
    ...toNationwideSummary(area),
    statusCounts: countStatus(area.chargers),
    dataQuality: 'normal',
  }
}

/** 전국 휴게소 목록 (15번 Mock) */
export const NATIONWIDE_SERVICE_AREAS: NationwideServiceArea[] =
  MOCK_NATIONWIDE_AREAS.map(toNationwideArea)

/** 전국 휴게소 한 곳의 충전기 현황 (16번 Mock). 없는 id면 null */
export function findNationwideServiceAreaChargers(id: string, now: Date) {
  const area = MOCK_NATIONWIDE_AREAS.find((a) => a.id === id)
  // 목록에 없는 id면 서버처럼 찾을 수 없음
  if (!area) return null
  return {
    serviceArea: toNationwideSummary(area),
    chargers: area.chargers.map((c, index) => ({
      ...c,
      chargingStartedAt:
        c.status === 'charging'
          ? toKstIso(new Date(now.getTime() - (index * 13 + 9) * 60_000))
          : null,
    })),
  }
}
