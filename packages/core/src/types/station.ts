// 백엔드 API 명세(docs/api/user.md) 기준. 응답 필드 이름을 바꾸지 않고 그대로 씀 (API-05)

/** 화면에서 고를 수 있는 시점. 0 = 지금 출발. 60분은 서비스에서 뺌 (2026-11-15) */
export type HorizonMinutes = 0 | 15 | 30

/** 예측 혼잡도. 예측 · 기준선이 모두 없으면 null */
export type PredictedCongestion = 'low' | 'medium' | 'high'

/** 현재 혼잡도는 null이 되지 않고, 예외 상태 두 가지가 더 있음 */
export type CurrentCongestion = PredictedCongestion | 'unknown' | 'unavailable'

export type DataQuality = 'normal' | 'missing' | 'delayed' | 'baseline'

/** 응답 최상위 값은 경과 시간만 반영해 missing이 오지 않음 */
export type ResponseDataQuality = Exclude<DataQuality, 'missing'>

export type ChargerStatus = 'available' | 'charging' | 'stopped' | 'maintenance' | 'unknown'

export type ConnectorType = 'dc_chademo' | 'ac3' | 'dc_combo' | 'nacs'

export type PredictionSource = 'model' | 'baseline'

export type Charger = {
  chargerId: string
  status: ChargerStatus
  connectorTypes: ConnectorType[]
  capacityKw: number
}

export type Prediction = {
  horizonMinutes: HorizonMinutes
  congestion: PredictedCongestion | null
  /** 기준선이면 항상 null. 모델이어도 대기 예측이 빠진 회차면 null */
  waitTimeP50Minutes: number | null
  waitTimeP90Minutes: number | null
  source: PredictionSource | null
  /** source가 model일 때 AI 패키지 배포 이름, 아니면 null. 화면에는 쓰지 않음 */
  modelVersion: string | null
}

export type Station = {
  stationId: string
  name: string
  address: string
  lat: number
  lng: number
  operator: string
  totalChargers: number
  availableChargers: number
  slowChargerCount: number
  midChargerCount: number
  /** 현재 혼잡도. 지도 마커는 예측 시점과 상관없이 항상 이 값 (REC-006) */
  congestion: CurrentCongestion
  dataQuality: DataQuality
  chargers: Charger[]
  /** 시점 순서대로. 0(지금) · 15 · 30분 */
  predictions: Prediction[]
  /** 예측 제공 여부. 마포 true, 서울 다른 구 false (false면 predictions 값이 모두 null) */
  predictionAvailable: boolean
}

export type StationsResponse = {
  updatedAt: string
  dataQuality: ResponseDataQuality
  stations: Station[]
}

export type ChargerDetail = Charger & {
  /** 현재 충전 시작 시각. 충전 중이 아니면 null (STN-003) */
  chargingStartedAt: string | null
}

export type StationDetail = Omit<Station, 'chargers'> & {
  chargers: ChargerDetail[]
}

export type StationDetailResponse = {
  updatedAt: string
  dataQuality: ResponseDataQuality
  station: StationDetail
}

export type StatusFilter = 'all' | 'available_only' | 'exclude_high'

export type RecommendationFilters = {
  connectorTypes: ConnectorType[]
  minCapacityKw: 100 | 200 | null
  statusFilter: StatusFilter
}

export type RecommendationsRequest = {
  lat: number
  lng: number
  filters?: RecommendationFilters
}

export type Recommendation = {
  rank: number
  station: Pick<
    Station,
    'stationId' | 'name' | 'lat' | 'lng' | 'totalChargers' | 'availableChargers'
  >
  /** 해당 시점 예측 */
  congestion: PredictedCongestion | null
  waitTimeP50Minutes: number | null
  waitTimeP90Minutes: number | null
  source: PredictionSource | null
  travelTimeMinutes: number
  distanceMeters: number
  /** estimate = Directions 실패로 직선거리 추정 (잠정) */
  travelTimeSource: 'directions' | 'estimate'
  /** 추천 설명 문구 (예: 가장 가까운 곳보다 4분 더 걸려요, 4분 더 걸리지만 덜 붐벼요) */
  reason: string
}

export type HorizonRecommendations = {
  horizonMinutes: HorizonMinutes
  /** 최대 3개. 후보가 부족하면 짧거나 빈 배열 */
  recommendations: Recommendation[]
}

export type RecommendationsResponse = {
  updatedAt: string
  dataQuality: ResponseDataQuality
  /** 시점 순서대로 (잠정). 화면은 0(지금) · 15 · 30분만 씀 */
  results: HorizonRecommendations[]
}

export type RouteRequest = {
  origin: { lat: number; lng: number }
  stationId: string
}

export type RouteResponse = {
  stationId: string
  travelTimeMinutes: number
  distanceMeters: number
  /** 경로 좌표 [위도, 경도] 배열 — 서버가 Directions 원본([경도, 위도])에서 순서를 바꿔 보냄 */
  path: [number, number][]
  /** 경로를 만든 길찾기 제공자. 화면에 출처를 작게 표시함 */
  provider: 'kakao' | 'naver'
}
