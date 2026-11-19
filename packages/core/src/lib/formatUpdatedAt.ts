/** 갱신 상태 문구용 시각 (예: 14:05) */
export function formatClock(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** 마지막 갱신 후 경과 시간 (예: 방금, 1분 전) */
export function formatElapsed(from: Date, now: Date) {
  const minutes = Math.floor((now.getTime() - from.getTime()) / 60_000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  return `${Math.floor(minutes / 60)}시간 전`
}

/** 갱신 상태 문구. 실패해도 마지막 정상값이 있으면 그 시각을 함께 표시 */
export function getUpdateStatusText(updatedAt: Date | null, isError: boolean, now: Date) {
  if (!updatedAt) return isError ? '충전소 정보를 불러오지 못했습니다' : null
  const clock = formatClock(updatedAt)
  return isError
    ? `갱신 실패 · ${clock} 데이터 표시 중`
    : `${clock} 기준 · ${formatElapsed(updatedAt, now)} 갱신`
}
