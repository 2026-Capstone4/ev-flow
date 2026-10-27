import { useEffect, useState } from 'react'
import { formatClock, formatElapsed } from '@/lib/formatUpdatedAt'

type UpdateStatusProps = {
  /** 마지막 정상 데이터 기준 시각 */
  updatedAt: Date | null
  isError: boolean
}

/** 갱신 실패 시에도 마지막 정상값 기준 시각을 함께 표시 */
export function UpdateStatus({ updatedAt, isError }: UpdateStatusProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  if (!updatedAt) return null

  const clock = formatClock(updatedAt)
  return (
    <span
      role="status"
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${
        isError ? 'bg-status-warning-bg text-status-warning' : 'bg-bg-subtle text-text-secondary'
      }`}
    >
      {isError
        ? `갱신 실패 · ${clock} 데이터 표시 중`
        : `${clock} 기준 · ${formatElapsed(updatedAt, now)} 갱신`}
    </span>
  )
}
