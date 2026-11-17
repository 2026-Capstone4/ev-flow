import { isStale } from '@/lib/admin/common'
import type { CollectionTarget } from '@/types/admin'

export type CollectionHealth = 'normal' | 'partial' | 'stopped'

export const COLLECTION_HEALTH_LABEL: Record<CollectionHealth, string> = {
  normal: '정상',
  partial: '일부 실패',
  stopped: '수집 끊김',
}

/** 수집 대상 하나의 상태. 20분 넘게 성공이 없으면 끊김, 마지막 실행이 실패 · 부분 성공이면 일부 실패 */
export function getTargetHealth(target: CollectionTarget, now: Date): CollectionHealth {
  // 마지막 성공이 20분 넘게 지났으면 사용자 화면 충전기가 모두 확인 불가가 되는 상태
  if (isStale(target.lastSuccessAt, now)) return 'stopped'
  // 최근 성공은 있지만 마지막 실행이 실패했거나 일부만 저장된 경우
  if (target.lastStatus === 'failed' || target.lastStatus === 'partial') return 'partial'
  return 'normal'
}

/** 요약 카드용 전체 수집 상태 — 대상 중 가장 나쁜 상태. 대상이 없으면 null */
export function getCollectionHealth(
  targets: CollectionTarget[],
  now: Date,
): CollectionHealth | null {
  // 응답에 수집 대상이 하나도 없으면 판정하지 않음
  if (targets.length === 0) return null
  const healths = targets.map((t) => getTargetHealth(t, now))
  // 하나라도 끊겼으면 끊김
  if (healths.includes('stopped')) return 'stopped'
  // 끊긴 건 없지만 실패가 있으면 일부 실패
  return healths.includes('partial') ? 'partial' : 'normal'
}

/** 결측률 설명 — 데이터 수집 화면 결측률 패널 제목 ⓘ 말풍선 */
export const MISSING_RATE_TOOLTIP =
  '수집할 때마다 받아야 할 충전기 상태 중 받지 못한 비율이에요. 진행 중인 수집은 빼고 계산하고, 3% 이상이면 빨간 막대로 표시해요.'

/** 결측 대체 예측 설명 — 결측률 패널 아래 문구 ⓘ 말풍선 */
export const IMPUTED_TOOLTIP =
  '혼잡도를 예측할 때 입력 데이터가 비어 있어서 모델이 빈 구간을 채운 값으로 예측한 건수예요. 예측은 도심 충전소만 해요.'
