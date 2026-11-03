// 백엔드 API 명세(docs/api/user.md) 기준. 응답 필드 이름을 바꾸지 않고 그대로 씀 (API-05)

export type HorizonMinutes = 15 | 30 | 60

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
  waitTimeP50Minutes: number | null
  waitTimeP90Minutes: number | null
  source: PredictionSource | null
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
  /** 항상 15 · 30 · 60분 순서로 3개 */
  predictions: Prediction[]
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
  /** 추천 설명 문구 (예: 가장 가까운 곳보다 4분 더 이동, 대기 12분 감소) */
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
  /** 15 · 30 · 60분 순서로 3개 (잠정) */
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
}
