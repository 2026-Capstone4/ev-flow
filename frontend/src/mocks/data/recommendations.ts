import { getDistanceMeters } from '@/lib/distance'
import { DEFAULT_FILTERS, matchesFilters } from '@/lib/stationFilter'
import { STATIONS } from '@/mocks/data/stations'
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

const CONGESTION_ORDER: Record<PredictedCongestion, number> = { low: 0, medium: 1, high: 2 }
const METERS_PER_MINUTE = 350

type Candidate = {
  station: Station
  prediction: Station['predictions'][number]
  distanceMeters: number
  travelTimeMinutes: number
}

function toCandidate(station: Station, horizon: HorizonMinutes, origin: LatLng): Candidate {
  const distanceMeters = Math.round(getDistanceMeters(origin, station))
  return {
    station,
    prediction: station.predictions.find((p) => p.horizonMinutes === horizon)!,
    distanceMeters,
    travelTimeMinutes: Math.max(1, Math.round(distanceMeters / METERS_PER_MINUTE)),
  }
}

function getReason(candidate: Candidate, nearest: Candidate) {
  if (candidate.station.stationId === nearest.station.stationId) return '가장 가까운 충전소'
  const extraMinutes = candidate.travelTimeMinutes - nearest.travelTimeMinutes
  const waitSaved =
    (nearest.prediction.waitTimeP50Minutes ?? 0) - (candidate.prediction.waitTimeP50Minutes ?? 0)
  const move =
    extraMinutes > 0 ? `가장 가까운 곳보다 ${extraMinutes}분 더 이동` : '이동 시간은 비슷함'
  return waitSaved > 0 ? `${move}, 대기 ${waitSaved}분 감소` : move
}

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

export function buildRecommendations(
  origin: LatLng,
  horizon: HorizonMinutes,
  filters: RecommendationFilters = DEFAULT_FILTERS,
): HorizonRecommendations {
  // 운영 불가 충전소는 필터와 상관없이 후보에서 뺌 (필터 판정 규칙)
  const candidates = STATIONS.filter(
    (station) => station.congestion !== 'unavailable' && matchesFilters(station, filters),
  ).map((station) => toCandidate(station, horizon, origin))
  if (candidates.length === 0) return { horizonMinutes: horizon, recommendations: [] }
  const nearest = candidates.reduce((a, b) => (a.distanceMeters <= b.distanceMeters ? a : b))
  const ranked = candidates
    .filter((c) => c.prediction.congestion !== null)
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
