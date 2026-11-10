import { getDistanceMeters } from '@/lib/distance'
import { DEFAULT_FILTERS, matchesFilters } from '@/lib/stationFilter'
import type { LatLng } from '@/types/geo'
import type {
  HorizonMinutes,
  HorizonRecommendations,
  PredictedCongestion,
  Recommendation,
  RecommendationFilters,
  Station,
} from '@/types/station'

// 실제 추천 점수 계산식은 미정이라 혼잡도 → 이동시간 순으로만 정렬

/** 정렬 우선순위 - 숫자가 작을수록 먼저 추천 (여유 → 보통 → 혼잡) */
const CONGESTION_ORDER: Record<PredictedCongestion, number> = { low: 0, medium: 1, high: 2 }
/** 직선거리로 이동시간을 어림잡는 속도 (도심 평균 약 21km/h) */
const METERS_PER_MINUTE = 350

/** 추천 후보 한 곳 - 충전소와 고른 시점의 예측, 내 위치에서의 거리 · 이동시간 */
type Candidate = {
  station: Station
  prediction: Station['predictions'][number]
  distanceMeters: number
  travelTimeMinutes: number
}

/** 충전소를 추천 후보로 바꾼다. 해당 시점(horizon)의 예측을 고르고 거리 · 이동시간을 계산 */
function toCandidate(station: Station, horizon: HorizonMinutes, origin: LatLng): Candidate | null {
  const prediction = station.predictions.find((p) => p.horizonMinutes === horizon)
  // 실제 서버 응답에서 이 시점 예측이 빠져 있으면 후보로 만들 수 없어 null - 추천 전체가 오류 나지 않게 함
  if (!prediction) return null
  const distanceMeters = Math.round(getDistanceMeters(origin, station))
  return {
    station,
    prediction,
    distanceMeters,
    // 아주 가까워도 "0분"으로 보이지 않게 최소 1분
    travelTimeMinutes: Math.max(1, Math.round(distanceMeters / METERS_PER_MINUTE)),
  }
}

/** 추천 카드의 "추천 이유" 문구를 가장 가까운 충전소와 비교해서 만든다 */
function getReason(candidate: Candidate, nearest: Candidate) {
  // 후보 자신이 가장 가까운 충전소면 비교할 대상이 없으니 바로 반환
  if (candidate.station.stationId === nearest.station.stationId) return '가장 가까운 충전소'
  const extraMinutes = candidate.travelTimeMinutes - nearest.travelTimeMinutes
  const waitSaved =
    (nearest.prediction.waitTimeP50Minutes ?? 0) - (candidate.prediction.waitTimeP50Minutes ?? 0)
  // 더 멀면 몇 분 더 가는지, 아니면 이동 시간이 비슷하다고 표시
  const move =
    extraMinutes > 0 ? `가장 가까운 곳보다 ${extraMinutes}분 더 이동` : '이동 시간은 비슷함'
  // 대기가 줄어드는 경우에만 감소분을 덧붙임
  return waitSaved > 0 ? `${move}, 대기 ${waitSaved}분 감소` : move
}

/** 후보를 API 응답 형식(Recommendation)으로 바꾼다. rank는 정렬된 순서(1부터) */
function toRecommendation(candidate: Candidate, index: number, nearest: Candidate): Recommendation {
  const { station, prediction } = candidate
  return {
    rank: index + 1,
    station: {
      stationId: station.stationId,
      name: station.name,
      lat: station.lat,
      lng: station.lng,
      totalChargers: station.totalChargers,
      availableChargers: station.availableChargers,
    },
    congestion: prediction.congestion,
    waitTimeP50Minutes: prediction.waitTimeP50Minutes,
    waitTimeP90Minutes: prediction.waitTimeP90Minutes,
    source: prediction.source,
    travelTimeMinutes: candidate.travelTimeMinutes,
    distanceMeters: candidate.distanceMeters,
    travelTimeSource: 'directions',
    reason: getReason(candidate, nearest),
  }
}

/**
 * 한 시점(horizon)의 추천 Top 3를 만든다.
 * 충전소 목록을 인자로 받아서 전체 Mock은 Mock 충전소로, 혼합 모드는 실제 충전소로 같은 계산을 함
 */
export function buildRecommendations(
  stations: Station[],
  origin: LatLng,
  horizon: HorizonMinutes,
  filters: RecommendationFilters = DEFAULT_FILTERS,
): HorizonRecommendations {
  // 운영 불가 충전소는 필터와 상관없이 후보에서 뺌 (필터 판정 규칙)
  const candidates = stations
    .filter((station) => station.congestion !== 'unavailable' && matchesFilters(station, filters))
    .map((station) => toCandidate(station, horizon, origin))
    .filter((candidate): candidate is Candidate => candidate !== null)
  // 필터에 맞는 충전소가 하나도 없으면 빈 추천 - 추천 시트의 "결과 없음" 상태로 이어짐
  if (candidates.length === 0) return { horizonMinutes: horizon, recommendations: [] }
  // 추천 이유 문구의 비교 기준. 예측이 없는 곳까지 포함해 가장 가까운 충전소
  const nearest = candidates.reduce((a, b) => (a.distanceMeters <= b.distanceMeters ? a : b))
  const ranked = candidates
    // 이 시점의 예측 혼잡도가 없는 곳은 순위를 매길 수 없어 제외
    .filter((c) => c.prediction.congestion !== null)
    // 혼잡도가 낮은 순, 같으면 이동시간이 짧은 순
    .sort(
      (a, b) =>
        CONGESTION_ORDER[a.prediction.congestion!] - CONGESTION_ORDER[b.prediction.congestion!] ||
        a.travelTimeMinutes - b.travelTimeMinutes,
    )
    .slice(0, 3)

  return {
    horizonMinutes: horizon,
    recommendations: ranked.map((candidate, index) => toRecommendation(candidate, index, nearest)),
  }
}
