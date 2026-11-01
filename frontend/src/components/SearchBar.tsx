import { Search } from 'lucide-react'

type SearchBarProps = {
  onClick?: () => void
}

/** 지도 홈 상단 검색창. 누르면 검색 · 필터 화면(04)으로 이동 */
export function SearchBar({ onClick }: SearchBarProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md bg-bg-page px-4 py-3 text-left shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
    >
      <Search aria-hidden size={20} strokeWidth={2} className="shrink-0 text-text-secondary" />
      <span className="flex-1 text-[15px] text-text-secondary">충전소·장소 검색 (예: 합정역)</span>
      <span className="text-sm font-bold text-brand-primary">필터</span>
    </button>
  )
}
