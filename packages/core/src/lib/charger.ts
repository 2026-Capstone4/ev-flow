import type { ChargerStatus, ConnectorType } from '../types/station'

export const CHARGER_STATUS_LABEL: Record<ChargerStatus, string> = {
  available: '사용 가능',
  charging: '충전 중',
  stopped: '운영 중지',
  maintenance: '점검 중',
  unknown: '확인 불가',
}

export const CONNECTOR_LABEL: Record<ConnectorType, string> = {
  dc_combo: 'DC콤보',
  dc_chademo: 'DC차데모',
  ac3: 'AC3상',
  nacs: 'NACS',
}

/** 충전기 행 표기 (예: DC콤보 · 100kW, DC차데모/AC3상 · 50kW) */
export function formatChargerSpec(connectorTypes: ConnectorType[], capacityKw: number) {
  const connectors = connectorTypes.map((type) => CONNECTOR_LABEL[type]).join('/')
  return `${connectors} · ${capacityKw}kW`
}

/** 충전 경과 시간 (예: 23분째, 1시간 5분째). 시작 시각이 없으면 null */
export function formatChargingElapsed(startedAt: string | null, now: Date) {
  if (!startedAt) return null
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 60_000))
  if (minutes < 60) return `${minutes}분째`
  const rest = minutes % 60
  return `${Math.floor(minutes / 60)}시간${rest ? ` ${rest}분` : ''}째`
}

/** 지금 상태 막대의 묶음. 운영 중지 · 점검 중은 둘 다 "쓸 수 없음"이라 하나로 묶음 */
export type ChargerStatusGroup = 'available' | 'charging' | 'offline' | 'unknown'

export const CHARGER_STATUS_GROUP_LABEL: Record<ChargerStatusGroup, string> = {
  available: '사용 가능',
  charging: '충전 중',
  offline: '점검 · 중지',
  unknown: '확인 불가',
}

const STATUS_GROUP: Record<ChargerStatus, ChargerStatusGroup> = {
  available: 'available',
  charging: 'charging',
  stopped: 'offline',
  maintenance: 'offline',
  unknown: 'unknown',
}

/** 충전기 상태를 묶음별로 센다 (막대 순서: 사용 가능 → 충전 중 → 점검 · 중지 → 확인 불가) */
export function countChargerStatusGroups(statuses: ChargerStatus[]) {
  const counts: Record<ChargerStatusGroup, number> = {
    available: 0,
    charging: 0,
    offline: 0,
    unknown: 0,
  }
  for (const status of statuses) counts[STATUS_GROUP[status]] += 1
  return counts
}
