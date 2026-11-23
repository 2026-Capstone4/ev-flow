import { HORIZONS, toCurrentPrediction } from '../lib/horizon'
import type {
  Charger,
  ChargerStatus,
  ConnectorType,
  CurrentCongestion,
  DataQuality,
  HorizonMinutes,
  PredictedCongestion,
  Prediction,
  Station,
  StationDetail,
} from '../types/station'

type MockStation = Omit<
  Station,
  'totalChargers' | 'availableChargers' | 'congestion' | 'predictions' | 'predictionAvailable'
> & {
  /** 예측 시점별 혼잡도. null이면 그 시점 예측 · 기준선 없음. 지금(0분)은 현재 혼잡도로 만듦 */
  forecast: Record<Exclude<HorizonMinutes, 0>, PredictedCongestion | null>
  /** 시점별 대기 구간(P50, P90 분). 없으면 혼잡도별 WAIT_TIME_RANGE를 씀 */
  waitRange?: Partial<Record<Exclude<HorizonMinutes, 0>, [number, number]>>
}

function charger(
  chargerId: string,
  status: ChargerStatus,
  connectorTypes: ConnectorType[] = ['dc_combo'],
  capacityKw = 100,
): Charger {
  return { chargerId, status, connectorTypes, capacityKw }
}

const NO_FORECAST = { 15: null, 30: null }

// 충전소 이름 · 좌표는 화면 개발용 예시 (실제 수집 데이터 아님)
// 현재 혼잡도 · 데이터 상태 · 예측 없음 등 화면 분기를 모두 볼 수 있게 구성
// 추천 데모 시나리오 (데모 위치 = 합정역 근처 DEMO_USER_LOCATION 기준)
// - 가장 가까운 합정(1분) · 홍대(3분)는 혼잡 → 조금 먼 망원(3분)이 대기가 짧아 1위
// - 연남동은 지금 혼잡이지만 15분 후 여유 예측 → "15분 후"를 고르면 추천에 새로 들어옴
const MOCK_STATIONS: MockStation[] = [
  {
    stationId: 'MOCK0001',
    name: '망원동 공영주차장 충전소',
    address: '서울 마포구 망원동 일대',
    lat: 37.5559,
    lng: 126.9019,
    operator: '기후에너지환경부',
    slowChargerCount: 2,
    midChargerCount: 0,
    dataQuality: 'normal',
    chargers: [
      charger('01', 'available', ['dc_combo'], 200),
      charger('02', 'available', ['dc_combo'], 200),
      charger('03', 'available', ['dc_chademo', 'ac3', 'dc_combo']),
      charger('04', 'charging', ['dc_chademo', 'ac3', 'dc_combo']),
    ],
    forecast: { 15: 'low', 30: 'low' },
  },
  {
    stationId: 'MOCK0002',
    name: '합정역 환승주차장 충전소',
    address: '서울 마포구 합정동 일대',
    lat: 37.5497,
    lng: 126.9148,
    operator: '한국전력',
    slowChargerCount: 0,
    midChargerCount: 0,
    dataQuality: 'normal',
    // 가장 가까운 충전소지만 둘 다 충전 중 → 지금 혼잡, 이후에도 혼잡 예측
    chargers: [charger('01', 'charging'), charger('02', 'charging')],
    forecast: { 15: 'high', 30: 'high' },
    // 혼잡일 때 대기가 긴 화면 확인용 (20분 넘음 · 40분 넘음)
    waitRange: { 15: [5, 35], 30: [25, 65] },
  },
  {
    stationId: 'MOCK0003',
    name: '홍대입구 공영주차장 충전소',
    address: '서울 마포구 동교동 일대',
    lat: 37.5577,
    lng: 126.9245,
    operator: '기후에너지환경부',
    slowChargerCount: 0,
    midChargerCount: 1,
    dataQuality: 'normal',
    chargers: [
      charger('01', 'charging', ['dc_combo'], 200),
      charger('02', 'charging', ['dc_combo'], 200),
      charger('03', 'charging'),
      charger('04', 'charging'),
    ],
    forecast: { 15: 'high', 30: 'high' },
  },
  {
    stationId: 'MOCK0004',
    name: '마포구청 충전소',
    address: '서울 마포구 성산동 일대',
    lat: 37.5663,
    lng: 126.9019,
    operator: '마포구청',
    slowChargerCount: 0,
    midChargerCount: 0,
    dataQuality: 'normal',
    chargers: [charger('01', 'maintenance'), charger('02', 'stopped')],
    forecast: NO_FORECAST,
  },
  {
    stationId: 'MOCK0005',
    name: '연남동 주민센터 충전소',
    address: '서울 마포구 연남동 일대',
    lat: 37.5636,
    lng: 126.9226,
    operator: '한국전력',
    slowChargerCount: 0,
    midChargerCount: 0,
    dataQuality: 'normal',
    // 지금은 전부 충전 중(혼잡)이지만 곧 끝날 예정 → 15 · 30분 후 여유 예측
    chargers: [charger('01', 'charging'), charger('02', 'charging'), charger('03', 'charging')],
    forecast: { 15: 'low', 30: 'low' },
  },
  {
    stationId: 'MOCK0006',
    name: '상암 디지털미디어시티 충전소',
    address: '서울 마포구 상암동 일대',
    lat: 37.5774,
    lng: 126.8913,
    operator: 'SK일렉링크',
    slowChargerCount: 4,
    midChargerCount: 0,
    dataQuality: 'normal',
    chargers: [
      charger('01', 'available', ['dc_combo'], 200),
      charger('02', 'available', ['dc_combo'], 200),
      charger('03', 'charging', ['dc_combo'], 200),
      charger('04', 'charging', ['dc_combo'], 200),
      charger('05', 'charging', ['dc_combo', 'nacs'], 200),
      charger('06', 'charging', ['dc_combo', 'nacs'], 200),
    ],
    forecast: { 15: 'low', 30: 'low' },
  },
  {
    stationId: 'MOCK0007',
    name: '공덕역 공영주차장 충전소',
    address: '서울 마포구 공덕동 일대',
    lat: 37.5446,
    lng: 126.9511,
    operator: '기후에너지환경부',
    slowChargerCount: 0,
    midChargerCount: 0,
    dataQuality: 'normal',
    chargers: [charger('01', 'charging'), charger('02', 'charging')],
    forecast: { 15: 'high', 30: 'high' },
  },
  {
    stationId: 'MOCK0008',
    name: '서교동 복합청사 충전소',
    address: '서울 마포구 서교동 일대',
    lat: 37.5527,
    lng: 126.9198,
    operator: '마포구청',
    slowChargerCount: 0,
    midChargerCount: 0,
    dataQuality: 'baseline',
    chargers: [charger('01', 'available'), charger('02', 'unknown'), charger('03', 'unknown')],
    forecast: { 15: 'medium', 30: 'medium' },
  },
  {
    stationId: 'MOCK0009',
    name: '망원한강공원 주차장 충전소',
    address: '서울 마포구 망원동 일대',
    lat: 37.5497,
    lng: 126.8986,
    operator: '서울시설공단',
    slowChargerCount: 0,
    midChargerCount: 0,
    dataQuality: 'normal',
    chargers: [
      charger('01', 'available', ['dc_chademo']),
      charger('02', 'available', ['dc_chademo', 'ac3']),
      charger('03', 'available'),
      charger('04', 'charging'),
    ],
    forecast: { 15: 'low', 30: 'low' },
  },
  {
    stationId: 'MOCK0010',
    name: '대흥역 공영주차장 충전소',
    address: '서울 마포구 대흥동 일대',
    lat: 37.5478,
    lng: 126.9419,
    operator: '한국전력',
    slowChargerCount: 0,
    midChargerCount: 0,
    dataQuality: 'missing',
    chargers: [
      charger('01', 'available'),
      charger('02', 'charging'),
      charger('03', 'charging'),
      charger('04', 'charging'),
      charger('05', 'unknown'),
    ],
    forecast: { 15: 'medium', 30: 'high' },
    // P50 · P90이 같은 화면 확인용 (15분 후)
    waitRange: { 15: [10, 10], 30: [15, 33] },
  },
]

const WAIT_TIME_RANGE: Record<PredictedCongestion, [number, number]> = {
  low: [0, 5],
  medium: [5, 15],
  high: [15, 30],
}

/** 모델 예측에 붙는 AI 패키지 배포 이름 (화면에는 쓰지 않음) */
const MOCK_MODEL_VERSION = 'mock_model'

/** 서버가 계산하는 현재 혼잡도를 흉내 냄 (요구사항분석서 p.9 판정 기준) */
function getCurrentCongestion(chargers: Charger[]): CurrentCongestion {
  const count = (status: ChargerStatus) => chargers.filter((c) => c.status === status).length
  const available = count('available')
  const charging = count('charging')
  if ((chargers.length - count('unknown')) / chargers.length < 0.8) return 'unknown'
  if (available + charging === 0) return 'unavailable'
  if (available === 0) return 'high'
  if (charging / (available + charging) < 0.5 && available >= 2) return 'low'
  return 'medium'
}

function toPrediction(
  horizonMinutes: HorizonMinutes,
  congestion: PredictedCongestion | null,
  dataQuality: DataQuality,
  waitRange?: [number, number],
): Prediction {
  const source = congestion ? (dataQuality === 'baseline' ? 'baseline' : 'model') : null
  // 대기 구간은 모델 예측에만 있음. 기준선 · 예측 없음은 서버처럼 null
  const [waitTimeP50Minutes, waitTimeP90Minutes] =
    congestion && source === 'model' ? (waitRange ?? WAIT_TIME_RANGE[congestion]) : [null, null]
  const modelVersion = source === 'model' ? MOCK_MODEL_VERSION : null
  return {
    horizonMinutes,
    congestion,
    waitTimeP50Minutes,
    waitTimeP90Minutes,
    source,
    modelVersion,
  }
}

function toStation({ forecast, waitRange, ...station }: MockStation): Station {
  const congestion = getCurrentCongestion(station.chargers)
  return {
    ...station,
    totalChargers: station.chargers.length,
    availableChargers: station.chargers.filter((c) => c.status === 'available').length,
    congestion,
    // 지금(0분)은 현재 혼잡도만(대기시간 없음), 15 · 30분은 forecast 값
    predictions: HORIZONS.map((horizon) =>
      horizon === 0
        ? toCurrentPrediction(congestion)
        : toPrediction(horizon, forecast[horizon], station.dataQuality, waitRange?.[horizon]),
    ),
    // 목업 충전소는 모두 마포라 예측 대상
    predictionAvailable: true,
  }
}

export const STATIONS: Station[] = MOCK_STATIONS.map(toStation)

/** 충전 중인 충전기마다 시작 시각을 몇 분씩 다르게 둠 */
export function findStationDetail(stationId: string, now: Date): StationDetail | null {
  const station = STATIONS.find((s) => s.stationId === stationId)
  if (!station) return null
  return {
    ...station,
    chargers: station.chargers.map((c, index) => ({
      ...c,
      chargingStartedAt:
        c.status === 'charging'
          ? toKstIso(new Date(now.getTime() - (index * 11 + 7) * 60_000))
          : null,
    })),
  }
}

/** 서버는 +09:00 오프셋을 붙여 보냄 (BE-09) */
export function toKstIso(date: Date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().replace(/\.\d{3}Z$/, '+09:00')
}
