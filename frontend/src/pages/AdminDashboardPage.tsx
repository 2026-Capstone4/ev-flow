import { ArrowDown, ArrowUp } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { AdminChargerTable } from '@/components/AdminChargerTable'
import { CollectionHealthLabel } from '@/components/CollectionHealthLabel'
import { CollectionTargetCard } from '@/components/CollectionTargetCard'
import { FilterChip } from '@/components/FilterChip'
import { RateBarChart } from '@/components/RateBarChart'
import { SegmentedControl } from '@/components/SegmentedControl'
import { StatCard } from '@/components/StatCard'
import { UpdateStatus } from '@/components/UpdateStatus'
import { useAdminDashboardData } from '@/hooks/useAdminDashboardData'
import { COLLECTION_SECTION_ID, useSectionHash } from '@/hooks/useSectionHash'
import {
  ADMIN_REGION_LABEL,
  CHARGER_SORT_LABEL,
  DEFAULT_SORT_DIRECTION,
  formatPercent,
  formatPeriodRange,
  getOccupancyLevel,
  MISSING_WARNING_RATE,
  SORT_DIRECTION_LABEL,
  toggleChargerSort,
  toMissingRows,
  toUtilizationRows,
  type ChargerSort,
  type ChargerSortKey,
  type OccupancyLevel,
} from '@/lib/admin'
import type { AdminPeriod, AdminRegion } from '@/types/admin'

const REGION_OPTIONS = (['all', 'city', 'service_area'] as const).map((value) => ({
  value,
  label: ADMIN_REGION_LABEL[value],
}))

const PERIOD_OPTIONS: { value: AdminPeriod; label: string }[] = [
  { value: 'day', label: '오늘' },
  { value: 'week', label: '최근 7일' },
]

const SORT_KEYS = Object.keys(CHARGER_SORT_LABEL) as ChargerSortKey[]

/** 이용률 막대 색 (Figma 09 범례: 파랑 · 주황 55%+ · 빨강 80%+) */
const OCCUPANCY_COLOR: Record<OccupancyLevel, string> = {
  low: 'var(--color-brand-primary)',
  medium: 'var(--color-congestion-normal)',
  high: 'var(--color-congestion-busy)',
}
const occupancyColor = (rate: number) => OCCUPANCY_COLOR[getOccupancyLevel(rate) ?? 'low']
const missingColor = (rate: number) =>
  rate >= MISSING_WARNING_RATE ? 'var(--color-congestion-busy)' : 'var(--color-brand-primary)'

/** 흰 카드 틀 — 제목 오른쪽에 부가 설명 · 버튼을 둘 수 있음 */
function Panel({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-lg border border-border-default bg-bg-page py-5">
      <header className="flex flex-wrap items-center justify-between gap-2 px-5">
        <h2 className="text-[15px] font-bold">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
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
  const [period, setPeriod] = useState<AdminPeriod>('day')
  const [sort, setSort] = useState<ChargerSort>({
    key: 'status',
    direction: DEFAULT_SORT_DIRECTION.status,
  })
  const data = useAdminDashboardData(region, period, sort)
  const { summary } = data
  // 사이드바 강조를 지금 보는 영역(운영 현황 · 데이터 수집)에 맞춤
  useSectionHash(COLLECTION_SECTION_ID)

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-bold">운영 현황</h1>
          <p className="text-[13px] text-text-secondary">
            마포구 도심 충전소 + 천안 고속도로 휴게소
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="지역"
            options={REGION_OPTIONS}
            value={region}
            onChange={setRegion}
          />
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
          aside={<span className="text-xs text-text-secondary">주황 55%+ · 빨강 80%+</span>}
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
        title="충전기 상태"
        aside={
          <div className="flex gap-1.5">
            {/* 고른 칩은 '기준 · 방향'으로 보이고, 다시 누르면 방향이 뒤집힘 */}
            {SORT_KEYS.map((key) => {
              const isSelected = sort.key === key
              const DirectionIcon = sort.direction === 'asc' ? ArrowUp : ArrowDown
              return (
                <FilterChip
                  key={key}
                  label={
                    isSelected
                      ? `${CHARGER_SORT_LABEL[key]} · ${SORT_DIRECTION_LABEL[key][sort.direction]}`
                      : CHARGER_SORT_LABEL[key]
                  }
                  icon={isSelected && <DirectionIcon size={14} aria-hidden />}
                  isSelected={isSelected}
                  onClick={() => setSort((current) => toggleChargerSort(current, key))}
                />
              )
            })}
          </div>
        }
      >
        {data.chargersLoadState === 'ready' && data.updatedAt ? (
          <AdminChargerTable chargers={data.sortedChargers} updatedAt={data.updatedAt} />
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
                  <span className="text-xs text-text-secondary">
                    {formatPeriodRange(data.missing.from, data.missing.to)} · 빨강{' '}
                    {formatPercent(MISSING_WARNING_RATE)}+
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
