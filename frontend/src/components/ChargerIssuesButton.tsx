import { TriangleAlert } from 'lucide-react'

type ChargerIssuesButtonProps = {
  onClick: () => void
}

/** 지도 홈 검색창 오른쪽 아래 작은 버튼. 누르면 상태 이상 충전기 목록 화면으로 감 */
export function ChargerIssuesButton({ onClick }: ChargerIssuesButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="상태 이상 충전기 보기"
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-bg-page px-3 py-1.5 text-xs font-medium text-text-primary shadow-[0_2px_8px_rgba(0,0,0,0.12)] active:opacity-80"
    >
      <TriangleAlert aria-hidden size={16} strokeWidth={2.2} className="text-status-warning" />
      상태 이상
    </button>
  )
}
