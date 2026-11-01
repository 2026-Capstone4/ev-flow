import type { Congestion, HorizonMinutes, Station } from '@/types/station'

type MockStation = Omit<Station, 'congestion' | 'waitTimeP50' | 'waitTimeP90'> & {
  /** 예측 시점별 혼잡도. null이면 예측값 없음 */
  forecast: Record<HorizonMinutes, Congestion> | null
}

// 충전소 이름 · 좌표는 화면 개발용 예시 (실제 수집 데이터 아님)
export const MOCK_STATIONS: MockStation[] = [
  {
    stationId: 'MOCK0001',
    name: '망원동 공영주차장 충전소',
    address: '서울 마포구 망원동 일대',
    lat: 37.5559,
    lng: 126.9019,
    totalChargers: 4,
    availableChargers: 2,
    forecast: { 15: 'low', 30: 'low', 60: 'medium' },
  },
  {
    stationId: 'MOCK0002',
    name: '합정역 환승주차장 충전소',
    address: '서울 마포구 합정동 일대',
    lat: 37.5497,
    lng: 126.9148,
    totalChargers: 2,
    availableChargers: 1,
    forecast: { 15: 'medium', 30: 'medium', 60: 'high' },
  },
  {
    stationId: 'MOCK0003',
    name: '홍대입구 공영주차장 충전소',
    address: '서울 마포구 동교동 일대',
    lat: 37.5577,
    lng: 126.9245,
    totalChargers: 4,
    availableChargers: 0,
    forecast: { 15: 'high', 30: 'high', 60: 'medium' },
  },
  {
    stationId: 'MOCK0004',
    name: '마포구청 충전소',
    address: '서울 마포구 성산동 일대',
    lat: 37.5663,
    lng: 126.9019,
    totalChargers: 2,
    availableChargers: 0,
    forecast: { 15: 'medium', 30: 'low', 60: 'low' },
  },
  {
    stationId: 'MOCK0005',
    name: '연남동 주민센터 충전소',
    address: '서울 마포구 연남동 일대',
    lat: 37.5636,
    lng: 126.9226,
    totalChargers: 3,
    availableChargers: 2,
    forecast: { 15: 'low', 30: 'medium', 60: 'medium' },
  },
  {
    stationId: 'MOCK0006',
    name: '상암 디지털미디어시티 충전소',
    address: '서울 마포구 상암동 일대',
    lat: 37.5774,
    lng: 126.8913,
    totalChargers: 6,
    availableChargers: 2,
    forecast: { 15: 'low', 30: 'low', 60: 'low' },
  },
  {
    stationId: 'MOCK0007',
    name: '공덕역 공영주차장 충전소',
    address: '서울 마포구 공덕동 일대',
    lat: 37.5446,
    lng: 126.9511,
    totalChargers: 2,
    availableChargers: 0,
    forecast: { 15: 'high', 30: 'high', 60: 'high' },
  },
  {
    stationId: 'MOCK0008',
    name: '서교동 복합청사 충전소',
    address: '서울 마포구 서교동 일대',
    lat: 37.5527,
    lng: 126.9198,
    totalChargers: 3,
    availableChargers: 1,
    forecast: null,
  },
  {
    stationId: 'MOCK0009',
    name: '망원한강공원 주차장 충전소',
    address: '서울 마포구 망원동 일대',
    lat: 37.5497,
    lng: 126.8986,
    totalChargers: 4,
    availableChargers: 3,
    forecast: { 15: 'low', 30: 'low', 60: 'low' },
  },
  {
    stationId: 'MOCK0010',
    name: '대흥역 공영주차장 충전소',
    address: '서울 마포구 대흥동 일대',
    lat: 37.5478,
    lng: 126.9419,
    totalChargers: 2,
    availableChargers: 1,
    forecast: { 15: 'medium', 30: 'high', 60: 'high' },
  },
]

const WAIT_TIME_RANGE: Record<Congestion, [number, number]> = {
  low: [0, 5],
  medium: [5, 15],
  high: [15, 30],
}

export function toStation({ forecast, ...station }: MockStation, horizon: HorizonMinutes): Station {
  const congestion = forecast?.[horizon] ?? null
  const [waitTimeP50, waitTimeP90] = congestion ? WAIT_TIME_RANGE[congestion] : [null, null]
  return { ...station, congestion, waitTimeP50, waitTimeP90 }
}
