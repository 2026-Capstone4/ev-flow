import { X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { BackButton } from '@/components/BackButton'
import { Button } from '@/components/Button'
import { FilterChip } from '@/components/FilterChip'
import { HorizonSelector } from '@/components/HorizonSelector'
import { SearchResultRow } from '@/components/SearchResultRow'
import { useMapView } from '@/hooks/useMapView'
import { useSearchData } from '@/hooks/useSearchData'
import { CONNECTOR_LABEL } from '@/lib/charger'
import { DEMO_USER_LOCATION } from '@/lib/constants'
import { DEFAULT_FILTERS, isDefaultFilters } from '@/lib/stationFilter'
import type { StationSortKey } from '@/lib/stationSearch'
import type { ConnectorType, RecommendationFilters, StatusFilter } from '@/types/station'

// 급속 · 초급속은 FLT-002 속도 필터의 100 · 200kW 기준
const CAPACITY_OPTIONS: { label: string; value: 100 | 200 }[] = [
  { label: '급속', value: 100 },
  { label: '초급속', value: 200 },
]
const STATUS_OPTIONS: { label: string; value: Exclude<StatusFilter, 'all'> }[] = [
  { label: '사용 가능만', value: 'available_only' },
  { label: '혼잡 제외', value: 'exclude_high' },
]
const SORT_OPTIONS: { label: string; value: StationSortKey }[] = [
  { label: '추천순', value: 'recommended' },
  { label: '거리순', value: 'distance' },
  { label: '대기 짧은순', value: 'wait' },
]
const CONNECTOR_OPTIONS = Object.keys(CONNECTOR_LABEL) as ConnectorType[]

function parseSortKey(value: string | null): StationSortKey {
  return SORT_OPTIONS.find((option) => option.value === value)?.value ?? 'recommended'
}

export function SearchPage() {
  const navigate = useNavigate()
  const { horizon, setHorizon, filters, setFilters } = useMapView()
  // 검색어 · 정렬은 URL에 두어 상세에서 뒤로 와도 유지. 입력은 한글 조합이 끊기지 않게 로컬 상태로 받음
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const sortKey = parseSortKey(searchParams.get('sort'))

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
  }

  const updateFilters = (next: Partial<RecommendationFilters>) =>
    setFilters({ ...filters, ...next })
  const toggleConnector = (type: ConnectorType) =>
    updateFilters({
      connectorTypes: filters.connectorTypes.includes(type)
        ? filters.connectorTypes.filter((t) => t !== type)
        : [...filters.connectorTypes, type],
    })

  const { results, isError } = useSearchData({
    origin: DEMO_USER_LOCATION,
    query,
    filters,
    horizon,
    sortKey,
  })

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
            placeholder="충전소 · 장소 검색 (예: 합정역)"
            aria-label="충전소 검색"
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:font-normal placeholder:text-text-secondary [&::-webkit-search-cancel-button]:hidden"
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
        <FilterRow label="충전 속도">
          {CAPACITY_OPTIONS.map(({ label, value }) => (
            <FilterChip
              key={value}
              label={label}
              isSelected={filters.minCapacityKw === value}
              onClick={() =>
                updateFilters({ minCapacityKw: filters.minCapacityKw === value ? null : value })
              }
            />
          ))}
        </FilterRow>
        {/* Figma 04에는 없지만 명세 FLT-001 커넥터 필터 */}
        <FilterRow label="커넥터">
          {CONNECTOR_OPTIONS.map((type) => (
            <FilterChip
              key={type}
              label={CONNECTOR_LABEL[type]}
              isSelected={filters.connectorTypes.includes(type)}
              onClick={() => toggleConnector(type)}
            />
          ))}
        </FilterRow>
        <FilterRow label="상태">
          {STATUS_OPTIONS.map(({ label, value }) => (
            <FilterChip
              key={value}
              label={label}
              isSelected={filters.statusFilter === value}
              onClick={() =>
                updateFilters({ statusFilter: filters.statusFilter === value ? 'all' : value })
              }
            />
          ))}
        </FilterRow>
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
        {results ? (
          <>
            <p className="px-4 pt-4 pb-1 text-[13px] font-medium text-text-secondary">
              검색 결과 {results.length}곳 · {horizon}분 후 예측 기준
            </p>
            {results.length > 0 ? (
              <ul>
                {results.map((result) => (
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

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex w-full items-start gap-2">
      <span className="w-14 shrink-0 py-1.5 text-[13px] font-medium text-text-secondary">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
