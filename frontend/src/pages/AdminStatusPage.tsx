import { ArrowDown, ArrowLeft, ArrowUp, Search, X } from 'lucide-react'
import { useState } from 'react'
import { AdminChargerTable } from '@/components/AdminChargerTable'
import { AdminPageHeader, AdminPanel, AdminPlaceholder, ColorSwatch } from '@/components/AdminPanel'
import { AdminRegionFilter } from '@/components/AdminRegionFilter'
import { AdminStationTable, type StationReturnPoint } from '@/components/AdminStationTable'
import { CollectionHealthLabel } from '@/components/CollectionHealthLabel'
import { FilterChip } from '@/components/FilterChip'
import { RateBarChart } from '@/components/RateBarChart'
import { SegmentedControl } from '@/components/SegmentedControl'
import { StatCard } from '@/components/StatCard'
import { UpdateStatus } from '@/components/UpdateStatus'
import { useAdminStatusData } from '@/hooks/useAdminStatusData'
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
  toUtilizationRows,
  type OccupancyLevel,
} from '@/lib/admin/charts'
import { formatPercent } from '@/lib/admin/common'
import type { AdminRegion } from '@/types/admin'

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

/**
 * 충전기별 보기에서 지금 보고 있는 충전소. 칩 어디를 눌러도 충전소별 보기로 돌아감
 * 전체 충전기는 위쪽 보기 전환으로 볼 수 있어서 선택만 푸는 버튼은 따로 두지 않음
 */
function SelectedStationChip({ stationName, onBack }: { stationName: string; onBack: () => void }) {
  return (
    <button
      type="button"
      aria-label={`충전소별 상태로 돌아가기 (${stationName})`}
      onClick={onBack}
      className="inline-flex h-[33px] max-w-64 items-center gap-1 rounded-full border border-brand-primary bg-brand-primary-bg pr-3 pl-2.5 text-[13px] font-bold text-brand-primary"
    >
      <ArrowLeft size={14} aria-hidden className="shrink-0" />
      <span className="truncate">{stationName}</span>
    </button>
  )
}

/** 충전소별 표에서 고른 충전소. 돌아올 때 그 줄 위치를 되살리려고 rowOffset도 기억 */
type SelectedStation = StationReturnPoint & { stationName: string }

/** 충전 현황 표 높이 (AdminStationTable · AdminChargerTable의 h-[480px]과 같게) */
const TABLE_HEIGHT = 480
export function AdminStatusPage() {
  const [region, setRegion] = useState<AdminRegion>('all')
  const [district, setDistrict] = useState('all')
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
  // 충전소별 표에서 누른 충전소. 충전기별 보기에서는 그 충전소만 거르고, 돌아온 뒤에는 돌아갈 줄 위치로 씀
  const [selectedStation, setSelectedStation] = useState<SelectedStation | null>(null)
  const data = useAdminStatusData(region, chargerSort, stationSort)

  // 충전기별 보기에서 충전소를 골라 들어왔으면 그 충전소의 충전기만 보여 줌
  const isStationPicked = statusView === 'charger' && selectedStation !== null
  // 정렬된 목록에서 검색어에 맞는 줄만 표에 보여 줌 (검색어는 두 보기가 함께 씀)
  // 충전소를 골라 들어왔으면 검색어 대신 충전소 ID로 거름 — 이름이 겹치는 다른 충전소가 섞이지 않게
  const visibleStations = filterByStationName(data.sortedStations, searchQuery)
  const visibleChargers = isStationPicked
    ? data.sortedChargers.filter((charger) => charger.stationId === selectedStation.stationId)
    : filterByStationName(data.sortedChargers, searchQuery)
  const visibleCount = statusView === 'station' ? visibleStations.length : visibleChargers.length
  const caption = SORT_CAPTION[statusView === 'station' ? stationSort.key : chargerSort.key]
  const { summary } = data

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <AdminPageHeader title="운영 현황" description="충전소별, 충전기별 운영 상태 실시간 확인">
        <AdminRegionFilter
          region={region}
          district={district}
          onRegionChange={(next) => {
            // 지역이 바뀌면 고른 충전소가 목록에서 빠질 수 있어서 선택을 풂
            setSelectedStation(null)
            setRegion(next)
          }}
          onDistrictChange={setDistrict}
        />
        {/* 늘 두 줄로 보여 주고 폭을 고정해, 문구가 바뀌어도(방금 · 59분 전 · 갱신 실패) 왼쪽 버튼이 밀리지 않게 함
            처음 불러오는 동안 문구가 없어도 같은 크기의 자리를 비워 둠 */}
        <div className="flex h-11 min-w-[8.5rem]">
          <UpdateStatus
            updatedAt={data.updatedAt}
            isError={data.isChargersError}
            twoLines
            className="w-full tabular-nums"
          />
        </div>
      </AdminPageHeader>

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
              ? `오늘 결측 대체 예측 ${data.imputed.imputedCount.toLocaleString('ko-KR')}건`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminPanel
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
            <AdminPlaceholder isError={data.isHourlyError} />
          )}
        </AdminPanel>
        <AdminPanel
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
            <AdminPlaceholder isError={data.isWeeklyError} />
          )}
        </AdminPanel>
      </div>

      <AdminPanel
        title={
          // 제목 자리에 보기 전환 — 고른 쪽 이름이 곧 패널 제목
          <SegmentedControl
            label="충전 현황 보기"
            options={STATUS_VIEW_OPTIONS}
            value={statusView}
            onChange={(view) => {
              // 위 전환으로 직접 바꾸면 고른 충전소 없이 전체 목록을 보여 줌
              setSelectedStation(null)
              setStatusView(view)
            }}
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
            {/* 충전소를 골라 들어왔으면 검색 자리에 그 충전소 칩. 검색어는 그대로 두었다가 돌아가면 다시 보임 */}
            {isStationPicked ? (
              <SelectedStationChip
                stationName={selectedStation.stationName}
                // 선택은 남겨 둬서 충전소별 표가 그 줄 위치로 돌아가게 함
                onBack={() => setStatusView('station')}
              />
            ) : (
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
            )}
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
              returnTo={selectedStation}
              onSelect={(station, rowOffset) => {
                // 충전소를 누르면 충전기별 보기로 넘어가서 그 충전소의 충전기만 보여 줌. 검색어는 건드리지 않음
                setSelectedStation({
                  stationId: station.stationId,
                  stationName: station.stationName,
                  rowOffset,
                })
                setStatusView('charger')
              }}
            />
          ) : (
            <AdminChargerTable chargers={visibleChargers} updatedAt={data.updatedAt} />
          )
        ) : data.chargersLoadState === 'empty' ? (
          // 표와 같은 높이 — 불러오는 중 · 없음 · 표 모두 패널 크기가 같게
          <p className="flex h-[480px] items-center justify-center border-y border-border-default px-5 text-center text-sm text-text-secondary">
            충전기가 없습니다
          </p>
        ) : (
          <AdminPlaceholder isError={data.chargersLoadState === 'error'} height={TABLE_HEIGHT} />
        )}
      </AdminPanel>
    </div>
  )
}
