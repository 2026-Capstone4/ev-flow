import { SHOWN_STEP } from '@/hooks/useShownCount'

/** 표 맨 아래 더보기 줄. 남은 줄이 없으면 그리지 않음 */
export function TableMoreRow({
  colSpan,
  shown,
  remaining,
  onMore,
}: {
  colSpan: number
  shown: number
  remaining: number
  onMore: () => void
}) {
  // 다 보여 주고 있으면 더보기 자리 없음
  if (remaining <= 0) return null
  return (
    <tr className="border-t border-border-default">
      <td colSpan={colSpan} className="px-5 py-3 text-center">
        <button
          type="button"
          onClick={onMore}
          className="rounded-full border border-border-default bg-bg-page px-4 py-1.5 text-[13px] font-medium text-text-primary hover:bg-bg-subtle"
        >
          {Math.min(remaining, SHOWN_STEP)}개 더보기
          <span className="ml-1 text-text-secondary">
            ({shown.toLocaleString('ko-KR')} / {(shown + remaining).toLocaleString('ko-KR')})
          </span>
        </button>
      </td>
    </tr>
  )
}
