import { X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { BackButton } from '@/components/BackButton'
import { Button } from '@/components/Button'
import { FilterChip } from '@/components/FilterChip'
import { HorizonSelector } from '@/components/HorizonSelector'
import { SearchResultRow } from '@/components/SearchResultRow'
import { FilterRow, StationFilterOptions } from '@/components/StationFilterOptions'
import { useMapView } from '@/hooks/useMapView'
import { useSearchData } from '@/hooks/useSearchData'
import { DEFAULT_FILTERS, isDefaultFilters } from '@/lib/stationFilter'
import type { StationSortKey } from '@/lib/stationSearch'

const SORT_OPTIONS: { label: string; value: StationSortKey }[] = [
  { label: '추천순', value: 'recommended' },
  { label: '거리순', value: 'distance' },
  { label: '대기 짧은순', value: 'wait' },
]

// 검색어가 없을 때 한 번에 보여 주는 충전소 수
const PAGE_SIZE = 30

function parseSortKey(value: string | null): StationSortKey {
  return SORT_OPTIONS.find((option) => option.value === value)?.value ?? 'recommended'
}

export function SearchPage() {
  const navigate = useNavigate()
  const { horizon, setHorizon, filters, setFilters, userLocation } = useMapView()
  // 검색어 · 정렬은 URL에 두어 상세에서 뒤로 와도 유지. 입력은 한글 조합이 끊기지 않게 로컬 상태로 받음
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const sortKey = parseSortKey(searchParams.get('sort'))
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const updateParams = (next: { q?: string; sort?: StationSortKey }) => {
    const params = { q: query, sort: sortKey, ...next }
    setSearchParams(
      {
        ...(params.q ? { q: params.q } : {}),
        ...(params.sort !== 'recommended' ? { sort: params.sort } : {}),
      },
      { replace: true },
    )
  }
  const changeQuery = (value: string) => {
    setQuery(value)
    updateParams({ q: value })
    // 검색어를 지우면 다시 처음 30곳부터 보여 줌
    setVisibleCount(PAGE_SIZE)
  }

  const { results, isError } = useSearchData({
    origin: userLocation,
    query,
    filters,
    horizon,
    sortKey,
  })
  // 검색어가 있으면 찾은 결과를 모두, 없으면 정렬 순서대로 visibleCount곳까지만 보여 줌
  const visibleResults = query ? results : results?.slice(0, visibleCount)
  const hasMore = !!results && !!visibleResults && visibleResults.length < results.length

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col bg-bg-page">
      <header className="flex shrink-0 items-center gap-2 px-4 py-2">
        <BackButton />
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-bg-subtle px-3.5 py-2.5">
          <input
            // 검색창을 눌러 들어온 화면이라 바로 입력할 수 있게 함
            autoFocus
            type="search"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="충전소 이름·주소 검색"
            aria-label="충전소 검색"
            className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:font-normal placeholder:text-text-secondary [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={() => changeQuery('')}
              className="shrink-0 text-text-secondary"
            >
              <X aria-hidden size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      </header>

      <section className="flex shrink-0 flex-col items-start gap-3 border-b border-border-default px-4 pt-2 pb-4">
        <HorizonSelector value={horizon} onChange={setHorizon} />
        <StationFilterOptions filters={filters} onChange={setFilters} />
        <FilterRow label="정렬">
          {SORT_OPTIONS.map(({ label, value }) => (
            <FilterChip
              key={value}
              label={label}
              isSelected={sortKey === value}
              onClick={() => updateParams({ sort: value })}
            />
          ))}
        </FilterRow>
      </section>

      <main className="flex-1 overflow-y-auto">
        {results && visibleResults ? (
          <>
            <p className="px-4 pt-4 pb-1 text-[13px] font-medium text-text-secondary">
              검색 결과 {results.length}곳 ·{' '}
              {horizon === 0 ? '지금 기준' : `${horizon}분 후 예측 기준`}
            </p>
            {results.length > 0 ? (
              <>
                <ul>
                  {visibleResults.map((result) => (
                    <li key={result.station.stationId}>
                      <SearchResultRow
                        result={result}
                        onClick={() =>
                          navigate(`/stations/${result.station.stationId}?horizon=${horizon}`)
                        }
                      />
                    </li>
                  ))}
                </ul>
                {hasMore && (
                  <div className="px-4 py-4">
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                    >
                      더보기 ({visibleResults.length}/{results.length})
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 pt-12 pb-6 text-center">
                <p className="text-base font-bold">조건에 맞는 충전소가 없어요</p>
                <p className="text-[13px] text-text-secondary">
                  필터를 줄이거나 다른 지역 이름으로 검색해 보세요.
                </p>
                {!isDefaultFilters(filters) && (
                  <Button
                    variant="secondary"
                    className="mt-2"
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                  >
                    필터 초기화
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="px-4 pt-12 text-center text-sm text-text-secondary">
            {isError ? '충전소 정보를 불러오지 못했습니다' : '불러오는 중…'}
          </p>
        )}
      </main>
    </div>
  )
}
