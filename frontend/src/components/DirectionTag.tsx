import { DIRECTION_LABEL } from '@/lib/serviceArea'
import type { Direction } from '@/types/serviceArea'

export function DirectionTag({ direction }: { direction: Direction }) {
  return (
    <span className="shrink-0 rounded-sm bg-bg-subtle px-2 py-0.5 text-xs font-medium text-text-secondary">
      {DIRECTION_LABEL[direction]}
    </span>
  )
}
