import {
  findNationwideServiceAreaChargers,
  NATIONWIDE_SERVICE_AREAS,
} from '@ev-flow/core/mocks/serviceAreas'
import { STATIONS, toKstIso } from '@ev-flow/core/mocks/stations'
import { SEOUL_DISTRICTS } from '@/lib/admin/common'
import type {
  AdminCharger,
  AdminPeriod,
  AdminRegion,
  CollectionTarget,
  CollectionTargetName,
  MissingBucket,
  MissingStatsResponse,
  UtilizationBucket,
  UtilizationResponse,
} from '@/types/admin'
import type { ChargerStatus } from '@ev-flow/core/types/station'

/** Mock 운영자 계정 — 화면 개발용 (실제 서버 계정 아님) */
export const MOCK_ADMIN = { loginId: 'admin', password: 'evflowmock', name: '운영자(Mock)' }

/** Mock 로그인 유지 시간. 실제 값은 SER-001 확정 후 서버가 정함 */
export const MOCK_SESSION_MS = 2 * 60 * 60_000

/** 비밀번호를 연속으로 이만큼 틀리면 잠깐 잠금 (429 LOGIN_LOCKED 화면 확인용) */
export const MOCK_MAX_LOGIN_FAILURES = 5
export const MOCK_LOCK_SECONDS = 60

/** 화면 상태 → API 원본 상태 코드. 확인 불가는 통신이상(1)과 상태미확인(9)을 번갈아 씀 */
function toStat(status: ChargerStatus, index: number) {
  const codes: Record<ChargerStatus, string> = {
    available: '2',
    charging: '3',
    stopped: '4',
    maintenance: '5',
    unknown: index % 2 === 0 ? '1' : '9',
  }
  return codes[status]
}

/** 0~1 사이 고정 난수 — 새로고침해도 같은 값이 나와 화면 비교가 쉬움 */
function seeded(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/** 지역 → 수집 대상 (백엔드 REGION_TARGETS와 같음). seoul = 마포구 + 나머지 서울 */
const REGION_TARGETS: Record<AdminRegion, CollectionTargetName[]> = {
  all: ['city', 'live', 'service_area'],
  seoul: ['city', 'live'],
  city: ['city'],
  service_area: ['service_area'],
}

/** 마포구 코드 — Mock 도심 충전소는 모두 마포구 */
const MAPO_DISTRICT = '11440'
/** 마포구를 뺀 서울 구 — Mock 서울(live) 충전소를 돌려 가며 나눠 줌 */
const OTHER_DISTRICTS = Object.keys(SEOUL_DISTRICTS).filter((code) => code !== MAPO_DISTRICT)

type MockCharger = Omit<AdminCharger, 'stat' | 'unstable' | 'todayOccupancyRate' | 'statUpdatedAt'>

/**
 * 운영자 충전기 목록. 도심(마포구)은 Mock 충전소, 휴게소는 Mock 휴게소 충전기에서 만듦
 * Mock에는 마포구 밖 서울 충전소가 없어서, 서울(live)은 마포 충전소를 복제해 다른 구에 하나씩 나눠 줌 (구 선택 확인용)
 */
export function buildAdminChargers(
  region: AdminRegion,
  now: Date,
  district: string | null = null,
): AdminCharger[] {
  const city: MockCharger[] = STATIONS.flatMap((station) =>
    station.chargers.map((c) => ({
      region: 'city' as const,
      stationId: station.stationId,
      stationName: station.name,
      district: MAPO_DISTRICT,
      districtName: SEOUL_DISTRICTS[MAPO_DISTRICT],
      chargerId: c.chargerId,
      status: c.status,
    })),
  )
  const live: MockCharger[] = STATIONS.flatMap((station, index) => {
    const code = OTHER_DISTRICTS[index % OTHER_DISTRICTS.length]
    return station.chargers.map((c) => ({
      region: 'live' as const,
      stationId: `LV${station.stationId}`,
      stationName: `${SEOUL_DISTRICTS[code]} 공영충전소 ${index + 1}`,
      district: code,
      districtName: SEOUL_DISTRICTS[code],
      chargerId: c.chargerId,
      status: c.status,
    }))
  })
  const serviceArea: MockCharger[] = NATIONWIDE_SERVICE_AREAS.flatMap((area) =>
    (findNationwideServiceAreaChargers(area.id, now)?.chargers ?? []).map((c) => ({
      region: 'service_area' as const,
      stationId: c.stationId,
      stationName: area.name,
      district: area.regionCode,
      districtName: area.regionName,
      chargerId: c.chargerId,
      status: c.status,
    })),
  )

  const targets = REGION_TARGETS[region]
  // 실서버처럼 같은 충전기는 어느 지역 · 구로 보든 같은 값이 나오게, 거르기 전 전체 순서로 값을 정함
  // 순서도 실서버(get_chargers)와 같이 마포구 → 나머지 서울 → 휴게소
  return (
    [...city, ...live, ...serviceArea]
      .map((c, index) => {
        const isUnknown = c.status === 'unknown'
        // Mock 충전소에는 실제 불안정 충전기 ID가 없어서, 확인 불가 충전기 3대 중 1대를 불안정으로 둠 (상태 이상 화면 확인용)
        // 실제 불안정 충전기는 2↔9를 오가므로 원본 코드도 9로 맞춤
        const isUnstable = isUnknown && index % 3 === 0
        return {
          ...c,
          stat: isUnstable ? '9' : toStat(c.status, index),
          unstable: isUnstable,
          // 확인 불가 충전기는 오늘 관측이 없는 것으로, 나머지는 0~85% 사이 고정값
          todayOccupancyRate: isUnknown ? null : Math.round(seeded(index + 1) * 85) / 100,
          // 확인 불가 충전기는 20분 넘게 갱신이 없던 것으로 보여 줌 (표의 빨간 수신 시각 확인용)
          statUpdatedAt: toKstIso(
            new Date(now.getTime() - (isUnknown ? 23 + index : index % 4) * 60_000),
          ),
        }
      })
      // 지역의 수집 대상만, 구를 골랐으면 그 구만
      .filter((c) => targets.includes(c.region) && (!district || c.district === district))
  )
}

/** KST 기준 오늘 0시 */
function startOfKstDay(now: Date) {
  const kst = new Date(now.getTime() + 9 * 60 * 60_000)
  kst.setUTCHours(0, 0, 0, 0)
  return new Date(kst.getTime() - 9 * 60 * 60_000)
}

/** KST 기준 현재 시(0~23) */
function kstHour(now: Date) {
  return new Date(now.getTime() + 9 * 60 * 60_000).getUTCHours()
}

/** 시간대별 이용률 모양 — 새벽 낮고 저녁 퇴근 시간에 가장 높음 (Figma 예시와 비슷하게) */
const HOURLY_SHAPE = [
  0.21, 0.14, 0.09, 0.07, 0.07, 0.1, 0.26, 0.47, 0.61, 0.53, 0.56, 0.58, 0.65, 0.62, 0.53, 0.57,
  0.64, 0.73, 0.84, 0.81, 0.69, 0.55, 0.38, 0.22,
]
/** 요일별(월~일) 평균 이용률 모양 */
const WEEKDAY_SHAPE = [0.48, 0.56, 0.52, 0.57, 0.66, 0.74, 0.71]
const WEEKDAY_LABEL = ['월', '화', '수', '목', '금', '토', '일']

/** 지역마다 값을 조금 다르게 — 필터를 바꾸면 차트가 바뀌는 걸 확인할 수 있게 함 */
const REGION_SCALE: Record<AdminRegion, number> = {
  all: 1,
  seoul: 1.1,
  city: 1.05,
  service_area: 0.8,
}

export function buildUtilization(
  region: AdminRegion,
  period: AdminPeriod,
  now: Date,
  district: string | null = null,
): UtilizationResponse {
  // 구를 골랐으면 구마다 0.6~1.2배로 다르게 해서 구를 바꾸면 차트가 바뀌게 함
  const scale = district ? 0.6 + seeded(Number(district)) * 0.6 : REGION_SCALE[region]
  const chargerCount = buildAdminChargers(region, now, district).length
  const today = startOfKstDay(now)
  const currentHour = kstHour(now)

  // 오늘 시간대별 24칸. 아직 오지 않은 시간은 관측이 없어 null
  const series: UtilizationBucket[] =
    period === 'day'
      ? HOURLY_SHAPE.map((rate, hour) => {
          const isFuture = hour > currentHour
          return {
            bucket: hour,
            label: `${hour}시`,
            occupancyRate: isFuture ? null : Math.min(1, rate * scale),
            observationCount: isFuture ? 0 : chargerCount * 12,
          }
        })
      : WEEKDAY_SHAPE.map((rate, day) => ({
          bucket: day,
          label: WEEKDAY_LABEL[day],
          occupancyRate: Math.min(1, rate * scale),
          observationCount: chargerCount * 12 * 24 * 4,
        }))

  const observed = series.filter((s) => s.occupancyRate !== null)
  const average =
    observed.length > 0
      ? observed.reduce((sum, s) => sum + (s.occupancyRate ?? 0), 0) / observed.length
      : null

  return {
    region,
    district,
    period,
    from: toKstIso(period === 'day' ? today : new Date(today.getTime() - 27 * 86_400_000)),
    to: toKstIso(now),
    averageOccupancyRate: average,
    series,
  }
}

export function buildCollectionTargets(region: AdminRegion, now: Date): CollectionTarget[] {
  const minutesAgo = (m: number) => toKstIso(new Date(now.getTime() - m * 60_000))
  const targets: CollectionTarget[] = [
    {
      target: 'city',
      zscode: '11440',
      lastRunAt: minutesAgo(1),
      lastStatus: 'success',
      lastSuccessAt: minutesAgo(1),
      failedRunsToday: 2,
      lastApiLatencyMs: 840,
      averageApiLatencyMsToday: 910,
    },
    {
      // 마포구를 뺀 서울 — 서울 Status(zcode=11)를 한 번에 받음
      target: 'live',
      zscode: '11',
      lastRunAt: minutesAgo(2),
      lastStatus: 'success',
      lastSuccessAt: minutesAgo(2),
      failedRunsToday: 1,
      lastApiLatencyMs: 2410,
      averageApiLatencyMsToday: 2280,
    },
    {
      // 휴게소는 마지막 실행이 일부만 저장된 상태로 둠 (일부 실패 표시 확인용)
      target: 'service_area',
      zscode: 'C0',
      lastRunAt: minutesAgo(1),
      lastStatus: 'partial',
      lastSuccessAt: minutesAgo(6),
      failedRunsToday: 3,
      lastApiLatencyMs: 1320,
      averageApiLatencyMsToday: 1050,
    },
  ]
  return targets.filter((t) => REGION_TARGETS[region].includes(t.target))
}

export function buildMissingStats(
  region: AdminRegion,
  period: AdminPeriod,
  now: Date,
): MissingStatsResponse {
  const chargerCount = buildAdminChargers(region, now).length
  const today = startOfKstDay(now)
  const currentHour = kstHour(now)

  /** 한 칸(실행 runs번)의 결측 집계. 실행이 없으면 결측률 null */
  const bucketOf = (
    bucket: number | string,
    label: string,
    runs: number,
    seed: number,
  ): MissingBucket => {
    const expectedCount = chargerCount * runs
    // 대부분 1% 안팎, 가끔 5% 가까이 튐
    const rate =
      runs === 0 ? 0 : seeded(seed) < 0.15 ? 0.04 + seeded(seed + 7) * 0.02 : seeded(seed) * 0.015
    const missingCount = Math.round(expectedCount * rate)
    return {
      bucket,
      label,
      expectedCount,
      matchedCount: expectedCount - missingCount,
      missingCount,
      missingRate: runs === 0 ? null : missingCount / expectedCount,
      failedRuns: rate > 0.03 ? 1 : 0,
    }
  }

  const series =
    period === 'day'
      ? // 오늘 0~23시, 아직 오지 않은 시간은 실행 0회
        Array.from({ length: 24 }, (_, hour) =>
          bucketOf(hour, `${hour}시`, hour > currentHour ? 0 : 12, hour + 100),
        )
      : // 최근 7일 날짜별 (5분 간격 = 하루 288회)
        Array.from({ length: 7 }, (_, i) => {
          const day = new Date(today.getTime() - (6 - i) * 86_400_000)
          const iso = toKstIso(day).slice(0, 10)
          return bucketOf(
            iso,
            `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`,
            288,
            i + 200,
          )
        })

  return {
    region,
    period,
    from: toKstIso(period === 'day' ? today : new Date(today.getTime() - 6 * 86_400_000)),
    to: toKstIso(now),
    series,
  }
}
