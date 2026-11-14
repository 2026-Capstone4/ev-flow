import { COLLECTION_HEALTH_LABEL, type CollectionHealth } from '@/lib/admin'

const HEALTH_CLASS: Record<CollectionHealth, string> = {
  normal: 'text-congestion-free',
  partial: 'text-status-warning',
  stopped: 'text-congestion-busy',
}

/** 수집 상태 문구 (정상 · 일부 실패 · 수집 끊김) — 요약 카드와 수집 대상 카드에서 같은 색으로 씀 */
export function CollectionHealthLabel({ health }: { health: CollectionHealth }) {
  return (
    <span className={`font-bold ${HEALTH_CLASS[health]}`}>{COLLECTION_HEALTH_LABEL[health]}</span>
  )
}
