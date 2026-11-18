import { Search } from 'lucide-react'

type SearchBarProps = {
  onSearchClick?: () => void
  onFilterClick?: () => void
  /** 적용 중인 필터 조건 수. 0이면 숫자를 숨김 */
  activeFilterCount?: number
  /** 필터 패널이 열려 있는지. 열려 있으면 필터 버튼을 눌린 모양으로 */
  isFilterOpen?: boolean
}

/** 지도 홈 상단 검색창. 왼쪽은 검색 화면(04)으로 이동, 오른쪽 필터는 지도 위 필터 패널을 엶 */
export function SearchBar({
  onSearchClick,
  onFilterClick,
  activeFilterCount = 0,
  isFilterOpen = false,
}: SearchBarProps) {
  return (
    <div className="flex w-full items-center rounded-md bg-bg-page shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
      <button
        type="button"
        onClick={onSearchClick}
        className="flex min-w-0 flex-1 items-center gap-2 py-3 pl-4 text-left"
      >
        <Search aria-hidden size={20} strokeWidth={2} className="shrink-0 text-text-secondary" />
        <span className="flex-1 truncate text-[15px] text-text-secondary">
          충전소 이름·주소 검색
        </span>
      </button>
      <button
        type="button"
        aria-expanded={isFilterOpen}
        aria-controls="map-filter-panel"
        onClick={onFilterClick}
        className={`mx-2 shrink-0 rounded-sm px-2 py-1.5 text-sm font-bold text-brand-primary ${
          isFilterOpen ? 'bg-brand-primary-bg' : ''
        }`}
      >
        필터{activeFilterCount > 0 && ` ${activeFilterCount}`}
      </button>
    </div>
  )
}
