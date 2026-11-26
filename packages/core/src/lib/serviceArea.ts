import type { ServiceAreaCharger } from '../types/serviceArea'

/** 휴게소는 예측을 제공하지 않음 (DATA-003) */
export const NO_FORECAST_SERVICE_AREA_LABEL = '실시간 정보만 제공'

export type OperatorChargerGroup = {
  operator: string
  /** 충전소별 충전기 목록. 충전기 번호는 충전소 안에서만 유일해서 충전소마다 나눔 */
  stations: { stationId: string; chargers: ServiceAreaCharger[] }[]
}

/**
 * 휴게소 충전기를 운영기관 → 충전소 순으로 묶는다. 응답 순서를 그대로 유지
 * 같은 운영기관이 한 휴게소에 충전소를 둘 이상 둔 경우가 있어(예: 입장거봉포도) 충전소 단위까지 나눔
 */
export function groupChargersByOperator(chargers: ServiceAreaCharger[]): OperatorChargerGroup[] {
  const groups: OperatorChargerGroup[] = []
  for (const charger of chargers) {
    // 원본 운영기관명 끝에 공백이 붙어 오는 경우가 있어(예: 'SK시그넷 ') 다듬은 이름으로 묶음
    const operator = charger.operator.trim()
    let group = groups.find((g) => g.operator === operator)
    // 처음 나온 운영기관이면 새 묶음을 만듦
    if (!group) {
      group = { operator, stations: [] }
      groups.push(group)
    }
    const station = group.stations.find((s) => s.stationId === charger.stationId)
    // 같은 충전소면 기존 목록에 붙이고, 처음 나온 충전소면 새 목록을 만듦
    if (station) station.chargers.push(charger)
    else group.stations.push({ stationId: charger.stationId, chargers: [charger] })
  }
  return groups
}

export type AvailabilityTone = 'free' | 'normal' | 'busy' | 'unknown'

/**
 * 휴게소는 예측 · 혼잡도가 없어 사용 가능 대수로만 색을 나눔.
 * 도심 현재 혼잡도 기준(2대 이상 여유, 1대 보통, 0대 혼잡)에 맞춤. 상태를 아는 충전기가 없으면 unknown
 */
export function getAvailabilityTone(
  availableChargers: number,
  totalChargers: number,
  unknownChargers: number,
): AvailabilityTone {
  if (totalChargers - unknownChargers === 0) return 'unknown'
  if (availableChargers >= 2) return 'free'
  return availableChargers === 1 ? 'normal' : 'busy'
}

export const AVAILABILITY_TONE_CLASS: Record<AvailabilityTone, string> = {
  free: 'text-congestion-free',
  normal: 'text-congestion-normal',
  busy: 'text-congestion-busy',
  unknown: 'text-text-secondary',
}
