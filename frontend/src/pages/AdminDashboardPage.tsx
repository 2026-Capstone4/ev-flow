import { ArrowDown, ArrowUp, Search, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { AdminChargerTable } from '@/components/AdminChargerTable'
import { AdminStationTable } from '@/components/AdminStationTable'
import { CollectionHealthLabel } from '@/components/CollectionHealthLabel'
import { CollectionTargetCard } from '@/components/CollectionTargetCard'
import { DistrictSelect } from '@/components/DistrictSelect'
import { FilterChip } from '@/components/FilterChip'
import { RateBarChart } from '@/components/RateBarChart'
import { SegmentedControl } from '@/components/SegmentedControl'
import { StatCard } from '@/components/StatCard'
import { UpdateStatus } from '@/components/UpdateStatus'
import { useAdminDashboardData } from '@/hooks/useAdminDashboardData'
import { COLLECTION_SECTION_ID, useSectionHash } from '@/hooks/useSectionHash'
import {
  CHARGER_SORT_KEYS,
  DEFAULT_SORT_DIRECTION,
  filterByStationName,
  SORT_CAPTION,
  SORT_DIRECTION_LABEL,
  SORT_LABEL,
  STATION_SORT_KEYS,
  STATUS_VIEW_LABEL,
  toggleSort,
  type ChargerSort,
  type Sort,
  type SortKey,
  type StationSort,
  type StatusView,
} from '@/lib/admin/chargerStatus'
import {
  formatPeriodRange,
  getOccupancyLevel,
  MISSING_WARNING_RATE,
  toMissingRows,
  toUtilizationRows,
  type OccupancyLevel,
} from '@/lib/admin/charts'
import { ADMIN_REGION_LABEL, DISTRICT_OPTIONS, formatPercent } from '@/lib/admin/common'
import type { AdminPeriod, AdminRegion } from '@/types/admin'

const REGION_OPTIONS = (['all', 'city', 'service_area'] as const).map((value) => ({
  value,
  label: ADMIN_REGION_LABEL[value],
}))

const PERIOD_OPTIONS: { value: AdminPeriod; label: string }[] = [
  { value: 'day', label: '오늘' },
  { value: 'week', label: '최근 7일' },
]

const STATUS_VIEW_OPTIONS = (['station', 'charger'] as const).map((value) => ({
  value,
  label: STATUS_VIEW_LABEL[value],
}))

/** 이용률 막대 색 (파랑 · 주황 60% 이상 · 빨강 80% 이상) */
const OCCUPANCY_COLOR: Record<OccupancyLevel, string> = {
  low: 'var(--color-brand-primary)',
  medium: 'var(--color-congestion-normal)',
  high: 'var(--color-congestion-busy)',
}
const occupancyColor = (rate: number) => OCCUPANCY_COLOR[getOccupancyLevel(rate) ?? 'low']
const MISSING_WARNING_COLOR = 'var(--color-congestion-busy)'
const missingColor = (rate: number) =>
  rate >= MISSING_WARNING_RATE ? MISSING_WARNING_COLOR : 'var(--color-brand-primary)'

/** 범례용 색 네모 — 차트 막대와 같은 색을 글자 대신 보여 줌 */
function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="inline-block size-2.5 shrink-0 rounded-[2px] align-[-1px]"
      style={{ backgroundColor: color }}
    />
  )
}

/**
 * 흰 카드 틀 — 제목 오른쪽에 부가 설명 · 버튼을 둘 수 있음
 * 제목이 문자열이면 h2로, 그 밖(전환 버튼 등)이면 받은 그대로 제목 자리에 둠
 */
function Panel({
  title,
  aside,
  children,
}: {
  title: ReactNode
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-lg border border-border-default bg-bg-page py-5">
      <header className="flex flex-wrap items-center justify-between gap-2 px-5">
        {typeof title === 'string' ? <h2 className="text-[15px] font-bold">{title}</h2> : title}
        {aside}
      </header>
      {children}
    </section>
  )
}

/** 정렬 칩 묶음. 고른 칩은 '기준 · 방향'으로 보이고, 다시 누르면 방향이 뒤집힘 */
function SortChips<K extends SortKey>({
  keys,
  sort,
  onChange,
}: {
  keys: K[]
  sort: Sort<K>
  onChange: (sort: Sort<K>) => void
}) {
  const DirectionIcon = sort.direction === 'asc' ? ArrowUp : ArrowDown
  return keys.map((key) => {
    const isSelected = sort.key === key
    return (
      <FilterChip
        key={key}
        label={
          isSelected
            ? `${SORT_LABEL[key]} · ${SORT_DIRECTION_LABEL[key][sort.direction]}`
            : SORT_LABEL[key]
        }
        icon={isSelected && <DirectionIcon size={14} aria-hidden />}
        isSelected={isSelected}
        onClick={() => onChange(toggleSort(sort, key))}
      />
    )
  })
}

/**
 * 충전 현황 표 충전소명 검색. 닫혀 있으면 돋보기 버튼만, 누르면 입력창으로 펼쳐짐
 * X · Esc를 누르면 검색어를 지우고 다시 닫힘
 */
function ChargerSearch({
  isOpen,
  query,
  onOpen,
  onClose,
  onQueryChange,
}: {
  isOpen: boolean
  query: string
  onOpen: () => void
  onClose: () => void
  onQueryChange: (query: string) => void
}) {
  // 닫혀 있으면 정렬 칩과 같은 높이의 동그란 돋보기 버튼
  if (!isOpen) {
    return (
      <button
        type="button"
        aria-label="충전소명 검색"
        onClick={onOpen}
        className="inline-flex size-[33px] shrink-0 items-center justify-center rounded-full border border-border-default bg-bg-page text-text-secondary"
      >
        <Search size={16} aria-hidden />
      </button>
    )
  }
  return (
    <div className="inline-flex h-[33px] w-44 items-center gap-1.5 rounded-full border border-brand-primary bg-bg-page pr-1 pl-3">
      <Search size={16} aria-hidden className="shrink-0 text-text-secondary" />
      <input
        type="search"
        aria-label="충전소명 검색"
        placeholder="충전소명"
        // 펼치자마자 바로 입력할 수 있게
        autoFocus
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          // Esc는 X 버튼과 같게 검색 종료
          if (event.key === 'Escape') onClose()
        }}
        className="min-w-0 flex-1 bg-transparent text-[13px] outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      <button
        type="button"
        aria-label="검색 닫기"
        onClick={onClose}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-text-secondary"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  )
}

/** 데이터가 없을 때 자리 표시 — 처음 불러오는 중이면 회색 상자, 실패면 안내 문구 */
function Placeholder({ isError, height = 180 }: { isError: boolean; height?: number }) {
  // 실패하고 보여 줄 이전 값도 없으면 안내 문구 (폴링이 다음 주기에 다시 시도함)
  if (isError) {
    return (
      <p
        className="flex items-center justify-center px-5 text-sm text-text-secondary"
        style={{ height }}
      >
        불러오지 못했습니다 · 잠시 후 자동으로 다시 시도합니다
      </p>
    )
  }
  return <div className="mx-5 animate-pulse rounded-md bg-bg-subtle" style={{ height }} />
}

export function AdminDashboardPage() {
  const [region, setRegion] = useState<AdminRegion>('all')
  // 도심 · 휴게소 안의 지역 (zscode). 지금은 지역마다 한 곳만 수집해서 어느 값이든 같은 데이터가 나옴
  const [district, setDistrict] = useState('all')
  const [period, setPeriod] = useState<AdminPeriod>('day')
  // 충전 현황 패널: 충전소별 · 충전기별 보기와 보기마다 따로 기억하는 정렬
  const [statusView, setStatusView] = useState<StatusView>('station')
  const [stationSort, setStationSort] = useState<StationSort>({
    key: 'status',
    direction: DEFAULT_SORT_DIRECTION.status,
  })
  const [chargerSort, setChargerSort] = useState<ChargerSort>({
    key: 'status',
    direction: DEFAULT_SORT_DIRECTION.status,
  })
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const data = useAdminDashboardData(region, period, chargerSort, stationSort)

  // 지역을 바꾸면 그 안의 지역 선택은 전체로 되돌림 (도심 · 휴게소의 선택지가 서로 달라서)
  function changeRegion(next: AdminRegion) {
    setRegion(next)
    setDistrict('all')
  }
  // 정렬된 목록에서 검색어에 맞는 줄만 표에 보여 줌 (검색어는 두 보기가 함께 씀)
  const visibleStations = filterByStationName(data.sortedStations, searchQuery)
  const visibleChargers = filterByStationName(data.sortedChargers, searchQuery)
  const visibleCount = statusView === 'station' ? visibleStations.length : visibleChargers.length
  const caption = SORT_CAPTION[statusView === 'station' ? stationSort.key : chargerSort.key]
  const { summary } = data
  // 사이드바 강조를 지금 보는 영역(운영 현황 · 데이터 수집)에 맞춤
  useSectionHash(COLLECTION_SECTION_ID)

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-bold">운영 현황</h1>
          <p className="text-[13px] text-text-secondary">
            충전소별, 충전기별 운영 상태 실시간 확인
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="지역"
            options={REGION_OPTIONS}
            value={region}
            onChange={changeRegion}
          />
          {/* 도심 · 휴게소를 골랐을 때만 그 안의 지역 선택을 보여 줌 */}
          {region !== 'all' && (
            <DistrictSelect
              label={`${ADMIN_REGION_LABEL[region]} 지역`}
              options={DISTRICT_OPTIONS[region]}
              value={district}
              onChange={setDistrict}
            />
          )}
          <UpdateStatus updatedAt={data.updatedAt} isError={data.isChargersError} />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="전체 충전기"
          value={summary && `${summary.total}기`}
          caption={
            summary ? `도심 ${summary.cityCount} · 휴게소 ${summary.serviceAreaCount}` : undefined
          }
        />
        <StatCard
          label="현재 이용률"
          value={summary && formatPercent(summary.currentOccupancyRate)}
          valueClassName="text-brand-primary"
          caption={
            data.hourly
              ? `오늘 평균 ${formatPercent(data.hourly.averageOccupancyRate, 1)}`
              : undefined
          }
        />
        <StatCard
          label="운영 중지 · 점검"
          value={summary && `${summary.faultCount}기`}
          valueClassName={summary?.faultCount ? 'text-status-warning' : 'text-text-primary'}
          caption={
            summary
              ? `도심 ${summary.cityFaultCount} · 휴게소 ${summary.serviceAreaFaultCount} · 확인 불가 ${summary.unknownCount}`
              : undefined
          }
        />
        <StatCard
          label="데이터 수집"
          value={data.collectionHealth && <CollectionHealthLabel health={data.collectionHealth} />}
          caption={
            data.imputed
              ? `${period === 'day' ? '오늘' : '최근 7일'} 결측 대체 예측 ${data.imputed.imputedCount.toLocaleString('ko-KR')}건`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="시간대별 이용률 (오늘)"
          aside={
            <span className="flex items-center gap-1 text-xs text-text-secondary">
              <ColorSwatch color={OCCUPANCY_COLOR.medium} label="주황" />
              60% 이상 ·
              <ColorSwatch color={OCCUPANCY_COLOR.high} label="빨강" />
              80% 이상
            </span>
          }
        >
          {data.hourly ? (
            <div className="px-5">
              <RateBarChart
                data={toUtilizationRows(data.hourly.series)}
                getColor={occupancyColor}
                tickInterval={5}
                ariaLabel="오늘 시간대별 이용률 막대 차트"
              />
            </div>
          ) : (
            <Placeholder isError={data.isHourlyError} />
          )}
        </Panel>
        <Panel
          title="요일별 평균 이용률 (최근 4주)"
          aside={
            data.weekly && (
              <span className="text-xs text-text-secondary">
                {formatPeriodRange(data.weekly.from, data.weekly.to)}
              </span>
            )
          }
        >
          {data.weekly ? (
            <div className="px-5">
              <RateBarChart
                data={toUtilizationRows(data.weekly.series)}
                getColor={occupancyColor}
                ariaLabel="최근 4주 요일별 평균 이용률 막대 차트"
              />
            </div>
          ) : (
            <Placeholder isError={data.isWeeklyError} />
          )}
        </Panel>
      </div>

      <Panel
        title={
          // 제목 자리에 보기 전환 — 고른 쪽 이름이 곧 패널 제목
          <SegmentedControl
            label="충전 현황 보기"
            options={STATUS_VIEW_OPTIONS}
            value={statusView}
            onChange={setStatusView}
          />
        }
        aside={
          <div className="flex flex-wrap items-center gap-1.5">
            {/* 보기마다 정렬 칩이 다름 (충전소별: 현재 이용률 / 충전기별: 오늘 이용률) */}
            {statusView === 'station' ? (
              <SortChips keys={STATION_SORT_KEYS} sort={stationSort} onChange={setStationSort} />
            ) : (
              <SortChips keys={CHARGER_SORT_KEYS} sort={chargerSort} onChange={setChargerSort} />
            )}
            <ChargerSearch
              isOpen={isSearchOpen}
              query={searchQuery}
              onOpen={() => setIsSearchOpen(true)}
              onClose={() => {
                setSearchQuery('')
                setIsSearchOpen(false)
              }}
              onQueryChange={setSearchQuery}
            />
          </div>
        }
      >
        {/* 이용률로 정렬 중이면 그 값이 무엇인지 표 위에 안내 */}
        {caption && <p className="-mt-1 px-5 text-[13px] text-text-secondary">{caption}</p>}
        {data.chargersLoadState === 'ready' && data.updatedAt ? (
          // 검색 결과가 없으면 빈 표 대신 안내 문구
          visibleCount === 0 ? (
            // 표와 같은 높이로 둬서 결과가 없어도 패널 크기가 바뀌지 않게
            <p className="flex h-[480px] items-center justify-center border-y border-border-default px-5 text-center text-sm text-text-secondary">
              '{searchQuery.trim()}'이(가) 들어간 충전소가 없습니다
            </p>
          ) : statusView === 'station' ? (
            <AdminStationTable
              stations={visibleStations}
              updatedAt={data.updatedAt}
              onSelect={(station) => {
                // 충전소를 누르면 충전기별 보기로 넘어가서 그 충전소를 검색한 상태로 보여 줌
                setSearchQuery(station.stationName)
                setIsSearchOpen(true)
                setStatusView('charger')
              }}
            />
          ) : (
            <AdminChargerTable chargers={visibleChargers} updatedAt={data.updatedAt} />
          )
        ) : data.chargersLoadState === 'empty' ? (
          <p className="px-5 py-8 text-center text-sm text-text-secondary">충전기가 없습니다</p>
        ) : (
          <Placeholder isError={data.chargersLoadState === 'error'} height={240} />
        )}
      </Panel>

      {/* 사이드바 '데이터 수집' 링크가 이 영역으로 이동 */}
      <section id={COLLECTION_SECTION_ID} className="flex scroll-mt-6 flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">데이터 수집</h2>
          <SegmentedControl
            label="기간"
            options={PERIOD_OPTIONS}
            value={period}
            onChange={setPeriod}
          />
        </header>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="수집 상태">
            <div className="flex flex-col gap-3 px-5">
              {data.targets ? (
                data.targets.map((target) => (
                  <CollectionTargetCard key={target.target} target={target} now={data.now} />
                ))
              ) : (
                <Placeholder isError={data.isCollectionError} height={120} />
              )}
            </div>
          </Panel>

          <div className="lg:col-span-2">
            <Panel
              title={`결측률 (${period === 'day' ? '오늘 시간대별' : '최근 7일'})`}
              aside={
                data.missing && (
                  <span className="flex items-center gap-1 text-xs text-text-secondary">
                    {formatPeriodRange(data.missing.from, data.missing.to)} ·
                    <ColorSwatch color={MISSING_WARNING_COLOR} label="빨강" />
                    {formatPercent(MISSING_WARNING_RATE)} 이상
                  </span>
                )
              }
            >
              {data.missing ? (
                <div className="px-5">
                  <RateBarChart
                    data={toMissingRows(data.missing.series)}
                    getColor={missingColor}
                    tickInterval={period === 'day' ? 5 : 0}
                    maxRate={0.1}
                    ariaLabel="기간별 수집 결측률 막대 차트"
                  />
                </div>
              ) : (
                <Placeholder isError={data.isMissingError} />
              )}
              <p className="px-5 text-[13px] text-text-secondary">
                결측 대체 예측{' '}
                {data.imputed ? (
                  <>
                    <strong className="text-text-primary">
                      {data.imputed.imputedCount.toLocaleString('ko-KR')}건
                    </strong>{' '}
                    / 전체 {data.imputed.totalCount.toLocaleString('ko-KR')}건 (
                    {formatPercent(
                      data.imputed.totalCount
                        ? data.imputed.imputedCount / data.imputed.totalCount
                        : null,
                      1,
                    )}
                    ) · 도심만
                  </>
                ) : data.isImputedError ? (
                  '불러오지 못했습니다'
                ) : (
                  '불러오는 중…'
                )}
              </p>
            </Panel>
          </div>
        </div>
      </section>
    </div>
  )
}
