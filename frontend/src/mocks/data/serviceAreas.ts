import { toKstIso } from '@/mocks/data/stations'
import type { Direction, ServiceArea, ServiceAreaCharger } from '@/types/serviceArea'
import type { ChargerStatus, ConnectorType, DataQuality } from '@/types/station'

type MockServiceArea = {
  name: string
  route: string
  direction: Direction
  dataQuality: DataQuality
  chargers: Omit<ServiceAreaCharger, 'chargingStartedAt'>[]
}

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

// 휴게소 · 운영기관 이름은 화면 개발용 예시 (실제 수집 데이터 아님)
const MOCK_SERVICE_AREAS: MockServiceArea[] = [
  {
    name: '천안삼거리휴게소',
    route: '경부',
    direction: 'up',
    dataQuality: 'normal',
    chargers: [
      charger('MOCKSA01', '한국도로공사', '01', 'available'),
      charger('MOCKSA01', '한국도로공사', '02', 'charging'),
    ],
  },
  {
    name: '입장거봉포도휴게소',
    route: '경부',
    direction: 'up',
    dataQuality: 'normal',
    chargers: [
      charger('MOCKSA02', '한국도로공사', '01', 'charging'),
      charger('MOCKSA02', '한국도로공사', '02', 'maintenance', ['dc_chademo', 'ac3'], 50),
    ],
  },
  {
    name: '망향휴게소',
    route: '경부',
    direction: 'down',
    dataQuality: 'normal',
    chargers: [
      charger('MOCKSA03', '한국도로공사', '01', 'available'),
      charger('MOCKSA03', '한국도로공사', '02', 'charging'),
      charger('MOCKSA04', 'SK일렉링크', '01', 'available', ['dc_combo'], 200),
      charger('MOCKSA04', 'SK일렉링크', '02', 'maintenance', ['dc_combo'], 200),
    ],
  },
  {
    name: '천안호두휴게소',
    route: '경부',
    direction: 'down',
    dataQuality: 'missing',
    chargers: [
      charger('MOCKSA05', '한국도로공사', '01', 'available'),
      charger('MOCKSA05', '한국도로공사', '02', 'available', ['dc_chademo', 'ac3'], 50),
      charger('MOCKSA06', '이브이시스', '01', 'charging'),
      charger('MOCKSA06', '이브이시스', '02', 'unknown'),
    ],
  },
]

function countStatus(chargers: MockServiceArea['chargers']) {
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

function toServiceArea({ chargers, ...area }: MockServiceArea): ServiceArea {
  const statusCounts = countStatus(chargers)
  return {
    ...area,
    totalChargers: chargers.length,
    availableChargers: statusCounts.available,
    statusCounts,
  }
}

export const SERVICE_AREAS: ServiceArea[] = MOCK_SERVICE_AREAS.map(toServiceArea)

export function findServiceAreaChargers(name: string, direction: Direction, now: Date) {
  const area = MOCK_SERVICE_AREAS.find((a) => a.name === name && a.direction === direction)
  if (!area) return null
  const { totalChargers, availableChargers, route } = toServiceArea(area)
  return {
    serviceArea: { name, route, direction, totalChargers, availableChargers },
    chargers: area.chargers.map((c, index) => ({
      ...c,
      chargingStartedAt:
        c.status === 'charging'
          ? toKstIso(new Date(now.getTime() - (index * 13 + 9) * 60_000))
          : null,
    })),
  }
}
