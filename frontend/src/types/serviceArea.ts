// 백엔드 API 명세(docs/api/user.md 5 · 6번) 기준. 휴게소는 예측이 없음 (DATA-003)
import type {
  ChargerDetail,
  ChargerStatus,
  DataQuality,
  ResponseDataQuality,
} from '@/types/station'

/** up = 상행(서울 방향), down = 하행(부산 방향) */
export type Direction = 'up' | 'down'

export type ServiceArea = {
  /** 휴게소명. 충전기 현황 요청의 name */
  name: string
  route: string
  direction: Direction
  totalChargers: number
  availableChargers: number
  /** 상태별 충전기 수 */
  statusCounts: Record<ChargerStatus, number>
  dataQuality: DataQuality
}

export type ServiceAreasResponse = {
  updatedAt: string
  dataQuality: ResponseDataQuality
  serviceAreas: ServiceArea[]
}

/** 한 휴게소에 운영기관이 여럿이라 충전기마다 충전소 ID · 운영기관이 붙음 */
export type ServiceAreaCharger = ChargerDetail & {
  stationId: string
  operator: string
}

export type ServiceAreaChargersResponse = {
  updatedAt: string
  dataQuality: ResponseDataQuality
  serviceArea: Pick<
    ServiceArea,
    'name' | 'route' | 'direction' | 'totalChargers' | 'availableChargers'
  >
  chargers: ServiceAreaCharger[]
}
