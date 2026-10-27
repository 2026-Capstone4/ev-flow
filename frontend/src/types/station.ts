// TODO(fe): 백엔드 API 명세 확정 후 필드 이름 · 구조 교체 (API-01, API-05)

export type Congestion = 'low' | 'medium' | 'high'

export type HorizonMinutes = 15 | 30 | 60

export type Station = {
  stationId: string
  name: string
  address: string
  lat: number
  lng: number
  totalChargers: number
  availableChargers: number
  /** 선택한 예측 시점의 혼잡도. 예측값이 없으면 null */
  congestion: Congestion | null
  waitTimeP50: number | null
  waitTimeP90: number | null
}

export type StationsResponse = {
  horizonMinutes: HorizonMinutes
  updatedAt: string
  stations: Station[]
}

export type Recommendation = {
  rank: number
  station: Station
  travelTimeMinutes: number
  /** 추천 설명 문구 (예: 가장 가까운 곳보다 4분 더 이동, 대기 12분 감소) */
  reason: string
}

export type RecommendationsResponse = {
  horizonMinutes: HorizonMinutes
  updatedAt: string
  recommendations: Recommendation[]
}
