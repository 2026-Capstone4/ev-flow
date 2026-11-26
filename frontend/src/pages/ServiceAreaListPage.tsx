import { ChevronRight, Search, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { BottomTab } from '@/components/BottomTab'
import { RouteBadge } from '@/components/RouteBadge'
import { ServiceAreaRow } from '@/components/ServiceAreaRow'
import { TabSwitch } from '@/components/TabSwitch'
import { UpdateStatus } from '@/components/UpdateStatus'
import { usePageTitle } from '@/hooks/usePageMeta'
import {
  toServiceAreaDetailPath,
  toServiceAreaRegionPath,
  toServiceAreaRoutePath,
} from '@/lib/serviceAreaPaths'
import { UNMATCHED_REGION_CODE } from '@ev-flow/core/hooks/useServiceAreaRegionData'
import { useServiceAreaRoutesData } from '@ev-flow/core/hooks/useServiceAreaRoutesData'
import { getRouteLabel } from '@ev-flow/core/lib/nationwideServiceArea'
import { NO_FORECAST_SERVICE_AREA_LABEL } from '@ev-flow/core/lib/serviceArea'
import type { NationwideServiceArea } from '@ev-flow/core/types/serviceArea'

type ListView = 'route' | 'region'

const VIEW_OPTIONS: { value: ListView; label: string }[] = [
  { value: 'route', label: '노선별' },
  { value: 'region', label: '지역별' },
]

// 전국 고속도로 휴게소 (하단 탭 두 번째). 노선별 · 지역별로 묶고, 누르면 노선 · 지역 화면으로 넘어감
// 위 검색창에 입력하면 묶음 대신 검색 결과를 보여 주고, 결과를 누르면 바로 휴게소 상세로 감 (앱 휴게소 탭과 같은 동작)
export function ServiceAreaListPage() {
  const navigate = useNavigate()
  // 노선 화면 · 상세에서 뒤로 돌아와도 고른 묶음과 검색어가 유지되도록 URL에 둠 (?view=region&q=)
  const [searchParams, setSearchParams] = useSearchParams()
  const view: ListView = searchParams.get('view') === 'region' ? 'region' : 'route'
  // 입력은 한글 조합이 끊기지 않게 로컬 상태로 받고, URL에는 같이 적어 둠
  const [searchText, setSearchText] = useState(() => searchParams.get('q') ?? '')
  const {
    routes,
    regions,
    searchResults,
    unmatchedCount,
    totalCount,
    updatedAt,
    isError,
    loadState,
  } = useServiceAreaRoutesData(searchText)
  const isSearching = searchText.trim() !== ''
  usePageTitle('고속도로 휴게소')

  // 기본값(노선별 · 빈 검색어)은 URL에서 빼서 주소를 짧게 둠. 화면 기록은 쌓지 않음
  const updateParams = (next: { view?: ListView; q?: string }) => {
    const params = { view, q: searchText, ...next }
    setSearchParams(
      {
        ...(params.view !== 'route' ? { view: params.view } : {}),
        ...(params.q ? { q: params.q } : {}),
      },
      { replace: true },
    )
  }
  const changeSearchText = (value: string) => {
    setSearchText(value)
    updateParams({ q: value })
  }

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col bg-bg-subtle">
      <main className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-[56px] pb-6">
        <header className="flex flex-col gap-0.5">
          <h1 className="text-[22px] font-bold">고속도로 휴게소</h1>
          <p className="text-[14px] text-text-secondary">
            전국{totalCount !== undefined && ` ${totalCount}곳`} · 현재 충전기 현황
          </p>
        </header>
        <div className="flex shrink-0 items-center gap-2 rounded-md bg-bg-page px-3.5">
          <Search aria-hidden size={18} strokeWidth={2} className="shrink-0 text-text-secondary" />
          <input
            type="search"
            value={searchText}
            onChange={(event) => changeSearchText(event.target.value)}
            placeholder="휴게소 · 고속도로 · 지역"
            aria-label="휴게소 검색"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent py-3.5 text-[17px] font-medium outline-none placeholder:text-text-secondary [&::-webkit-search-cancel-button]:hidden"
          />
          {/* 검색어가 있을 때만 지우기 버튼 */}
          {searchText !== '' && (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={() => changeSearchText('')}
              className="shrink-0 text-text-secondary"
            >
              <X aria-hidden size={16} strokeWidth={2} />
            </button>
          )}
        </div>
        {/* 검색 중에는 묶음 탭이 결과와 상관없어서 숨김 */}
        {!isSearching && (
          <TabSwitch
            options={VIEW_OPTIONS}
            value={view}
            onChange={(value) => updateParams({ view: value })}
            label="휴게소 묶음"
          />
        )}
        <div className="flex items-center justify-between gap-2">
          <UpdateStatus updatedAt={updatedAt} isError={isError} />
          <span className="shrink-0 text-xs font-medium text-text-secondary">
            {NO_FORECAST_SERVICE_AREA_LABEL}
          </span>
        </div>

        {/* 검색 중이면 검색 결과, 아니면 고른 묶음(노선별 · 지역별) */}
        {isSearching && searchResults ? (
          <SearchResults
            results={searchResults}
            onClick={(id) => navigate(toServiceAreaDetailPath(id))}
          />
        ) : loadState === 'ready' && view === 'region' ? (
          <ul className="overflow-hidden rounded-lg bg-bg-page">
            {regions?.map((region, index) => (
              <GroupRow
                key={region.code}
                title={region.label}
                count={region.areaCount}
                isFirst={index === 0}
                onClick={() => navigate(toServiceAreaRegionPath(region.code))}
              />
            ))}
          </ul>
        ) : loadState === 'ready' ? (
          <ul className="overflow-hidden rounded-lg bg-bg-page">
            {routes?.map((route, index) => (
              <GroupRow
                key={route.routeName}
                // 세 자리 번호 배지만큼 자리를 잡아 두어 노선 이름이 줄마다 같은 위치에서 시작하게 함
                badge={
                  <span className="flex w-[36px] shrink-0 justify-center">
                    <RouteBadge routeNo={route.routeNo} />
                  </span>
                }
                title={route.label}
                // 양 끝 도시는 방향 버튼이 있는 노선만 (순환선 등은 없음)
                subtitle={route.ends && `${route.ends[0]}–${route.ends[1]}`}
                count={route.areaCount}
                isFirst={index === 0}
                onClick={() => navigate(toServiceAreaRoutePath(route.routeName))}
              />
            ))}
            {/* 노선을 못 붙인 휴게소(민자 노선 등)는 맨 아래 한 줄로 모아 시도별 화면으로 */}
            {!!unmatchedCount && (
              <GroupRow
                title="노선 미확인"
                subtitle="민자 고속도로 등"
                count={unmatchedCount}
                isFirst={false}
                onClick={() => navigate(toServiceAreaRegionPath(UNMATCHED_REGION_CODE))}
              />
            )}
          </ul>
        ) : loadState === 'loading' ? (
          <div className="h-[240px] shrink-0 animate-pulse rounded-lg bg-bg-page" />
        ) : (
          <p className="py-12 text-center text-sm text-text-secondary">
            {loadState === 'error' ? '휴게소 정보를 불러오지 못했습니다' : '휴게소가 없습니다'}
          </p>
        )}
      </main>
      <BottomTab />
    </div>
  )
}

type GroupRowProps = {
  /** 왼쪽 배지 (노선 번호). 지역 줄은 없음 */
  badge?: ReactNode
  title: string
  /** 이름 옆 작은 글자 (노선 양 끝 도시 등) */
  subtitle?: string | null
  /** 오른쪽 휴게소 수 */
  count: number
  isFirst: boolean
  onClick: () => void
}

/** 노선별 · 지역별 목록 한 줄. 배지 · 이름 · 작은 설명 · 휴게소 수 · 화살표 */
function GroupRow({ badge, title, subtitle, count, isFirst, onClick }: GroupRowProps) {
  return (
    <li className={isFirst ? '' : 'border-t border-border-default'}>
      <button
        type="button"
        aria-label={`${title} 휴게소 ${count}곳`}
        onClick={onClick}
        className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left active:bg-bg-subtle"
      >
        {badge}
        <span className="min-w-0 flex-1 truncate">
          <span className="text-base font-bold text-text-primary">{title}</span>
          {/* 작은 설명이 있을 때만 이름 옆에 */}
          {subtitle && (
            <span className="text-[14px] text-text-secondary">&nbsp;&nbsp;{subtitle}</span>
          )}
        </span>
        <span className="shrink-0 text-sm text-text-secondary">{count}곳</span>
        <ChevronRight
          aria-hidden
          size={18}
          strokeWidth={2}
          className="shrink-0 text-text-secondary"
        />
      </button>
    </li>
  )
}

type SearchResultsProps = {
  results: NationwideServiceArea[]
  onClick: (id: string) => void
}

/** 검색 결과 목록. 이름은 방향이 들어간 이름, 옆에 노선(없으면 노선 미확인)을 작게 */
function SearchResults({ results, onClick }: SearchResultsProps) {
  // 찾은 휴게소가 없으면 안내 문구만
  if (results.length === 0) {
    return <p className="py-12 text-center text-sm text-text-secondary">찾는 휴게소가 없어요</p>
  }
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[14px] font-medium text-text-secondary">
        검색 결과 {results.length}곳
      </h2>
      <ul className="overflow-hidden rounded-lg bg-bg-page">
        {results.map((area, index) => (
          <ServiceAreaRow
            key={area.id}
            serviceArea={area}
            title={area.name}
            note={area.routeName ? getRouteLabel(area.routeName) : '노선 미확인'}
            isFirst={index === 0}
            onClick={() => onClick(area.id)}
          />
        ))}
      </ul>
    </section>
  )
}
