import { useNow } from '@/hooks/useNow'
import { getUpdateStatusText } from '@/lib/formatUpdatedAt'

type UpdateStatusProps = {
  /** 마지막 정상 데이터 기준 시각 */
  updatedAt: Date | null
  isError: boolean
}

export function UpdateStatus({ updatedAt, isError }: UpdateStatusProps) {
  const now = useNow()
  const text = getUpdateStatusText(updatedAt, isError, now)
  if (!text) return null

  return (
    <span
      role="status"
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${
        isError ? 'bg-status-warning-bg text-status-warning' : 'bg-bg-subtle text-text-secondary'
      }`}
    >
      {text}
    </span>
  )
}
