import { useNow } from '@ev-flow/core/hooks/useNow'
import { getUpdateStatusText } from '@ev-flow/core/lib/formatUpdatedAt'

type UpdateStatusProps = {
  /** 마지막 정상 데이터 기준 시각 */
  updatedAt: Date | null
  isError: boolean
  /** 화면마다 덧붙일 스타일 (예: 폭 고정) */
  className?: string
  /** 켜면 ' · ' 앞뒤를 두 줄로 나눠 보여 줌 (예: '14:05 기준' / '1분 전 갱신') */
  twoLines?: boolean
}

export function UpdateStatus({
  updatedAt,
  isError,
  className = '',
  twoLines = false,
}: UpdateStatusProps) {
  const now = useNow()
  const text = getUpdateStatusText(updatedAt, isError, now)
  if (!text) return null

  return (
    <span
      role="status"
      className={`inline-flex items-center px-3 py-1.5 text-xs font-medium ${
        twoLines ? 'flex-col rounded-xl text-center' : 'rounded-full'
      } ${
        isError ? 'bg-status-warning-bg text-status-warning' : 'bg-bg-subtle text-text-secondary'
      } ${className}`}
    >
      {twoLines ? text.split(' · ').map((line) => <span key={line}>{line}</span>) : text}
    </span>
  )
}
