import { useState } from 'react'
import { AdminPageHeader, AdminPanel, AdminPlaceholder, ColorSwatch } from '@/components/AdminPanel'
import { AdminRegionFilter } from '@/components/AdminRegionFilter'
import { CollectionTargetCard } from '@/components/CollectionTargetCard'
import { InfoTooltip } from '@/components/InfoTooltip'
import { RateBarChart } from '@/components/RateBarChart'
import { SegmentedControl } from '@/components/SegmentedControl'
import { UpdateStatus } from '@/components/UpdateStatus'
import { useAdminCollectionData } from '@/hooks/useAdminCollectionData'
import { formatPeriodRange, MISSING_WARNING_RATE, toMissingRows } from '@/lib/admin/charts'
import { IMPUTED_TOOLTIP, MISSING_RATE_TOOLTIP } from '@/lib/admin/collection'
import { formatPercent } from '@/lib/admin/common'
import type { AdminPeriod, AdminRegion } from '@/types/admin'

const PERIOD_OPTIONS: { value: AdminPeriod; label: string }[] = [
  { value: 'day', label: '오늘' },
  { value: 'week', label: '최근 7일' },
]

/** 결측률 막대 색 (파랑 · 빨강 경고 기준 이상) */
const MISSING_WARNING_COLOR = 'var(--color-congestion-busy)'
const missingColor = (rate: number) =>
  rate >= MISSING_WARNING_RATE ? MISSING_WARNING_COLOR : 'var(--color-brand-primary)'

/** 지역 · 기간을 바꾼 뒤 새 응답을 기다리는 동안 이전 값을 흐리게 보여 줌 */
const staleClass = (isStale: boolean) => (isStale ? 'opacity-40' : '')

/**
 * 수집 상태 카드 2장(간격 12px 포함) 높이 — 처음 불러오는 동안 자리 표시용 (CollectionTargetCard 실제 크기)
 * lg ~ xl 사이는 칸이 좁아 'API 응답' 줄이 두 줄이 되어 더 높음
 */
const TARGET_CARDS_HEIGHT_CLASS = 'h-[285px] lg:h-[324px] xl:h-[285px]'

export function AdminCollectionPage() {
  const [region, setRegion] = useState<AdminRegion>('all')
  const [district, setDistrict] = useState('all')
  const [period, setPeriod] = useState<AdminPeriod>('day')
  const data = useAdminCollectionData(region, period)
  // 차트 x축은 고른 기간이 아니라 지금 그려진 응답의 기간을 따름 (새 응답이 오기 전 둘이 다를 수 있음)
  const shownPeriod = data.missing?.period ?? period

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <AdminPageHeader title="데이터 수집" description="수집 상태와 결측률, 결측 대체 예측 확인">
        <AdminRegionFilter
          region={region}
          district={district}
          onRegionChange={setRegion}
          onDistrictChange={setDistrict}
        />
        {/* 운영 현황과 같은 두 줄 · 고정 폭 — 다시 불러오다 실패하면 마지막 정상값 시각과 함께 경고
            아무것도 못 받았을 때는 각 패널이 실패 안내를 하므로 여기서는 경고하지 않음 */}
        <div className="flex h-11 min-w-[8.5rem]">
          <UpdateStatus
            updatedAt={data.updatedAt}
            isError={data.updatedAt !== null && data.isAnyError}
            twoLines
            className="w-full tabular-nums"
          />
        </div>
      </AdminPageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminPanel title="수집 상태">
          {data.targets ? (
            // 같은 높이 두 줄로 나눠서 도심 · 휴게소만 골라 카드가 1장이어도 2장일 때와 높이가 같게 함
            // (빈 둘째 줄도 첫째 줄 카드 높이만큼 자리를 차지 — 패널 · 옆 차트 크기가 지역마다 바뀌지 않음)
            <div className={`grid grid-rows-2 gap-3 px-5 ${staleClass(data.isTargetsStale)}`}>
              {data.targets.map((target) => (
                <CollectionTargetCard key={target.target} target={target} now={data.now} />
              ))}
            </div>
          ) : (
            // 지역과 상관없이 카드 2장 높이만큼 자리를 잡음 (불러온 뒤에도 늘 2장 높이)
            <AdminPlaceholder
              isError={data.isCollectionError}
              heightClassName={TARGET_CARDS_HEIGHT_CLASS}
            />
          )}
        </AdminPanel>

        {/* 안쪽도 grid로 둬서 패널이 칸 높이만큼 늘어남 — 넓은 화면에서 수집 상태 패널과 높이가 같게 */}
        <div className="grid lg:col-span-2">
          <AdminPanel
            title={
              // 기간은 결측률 · 결측 대체 예측에만 적용돼서 이 패널 제목 옆에 둠 (수집 상태는 늘 오늘 기준)
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="flex items-center gap-1.5 text-[15px] font-bold">
                  결측률
                  <InfoTooltip text={MISSING_RATE_TOOLTIP} label="결측률 설명" />
                </h2>
                <SegmentedControl
                  label="기간"
                  options={PERIOD_OPTIONS}
                  value={period}
                  onChange={setPeriod}
                />
              </div>
            }
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
              // 패널이 수집 상태 높이만큼 늘어나면 남는 높이를 차트가 채움
              <div className={`flex flex-1 flex-col px-5 ${staleClass(data.isMissingStale)}`}>
                <RateBarChart
                  height="fill"
                  data={toMissingRows(data.missing.series)}
                  getColor={missingColor}
                  tickInterval={shownPeriod === 'day' ? 5 : 0}
                  maxRate={0.1}
                  ariaLabel="기간별 수집 결측률 막대 차트"
                />
              </div>
            ) : (
              <AdminPlaceholder isError={data.isMissingError} />
            )}
            {/* 패널이 수집 상태 높이만큼 늘어나도 문구는 맨 아래에 붙여 옆 패널과 아랫선을 맞춤 */}
            <p
              className={`mt-auto px-5 text-[13px] text-text-secondary ${staleClass(data.isMissingStale)}`}
            >
              {/* 글자와 ⓘ 아이콘을 한 덩어리로 묶어 세로 가운데를 맞춤 */}
              <span className="inline-flex items-center gap-1 align-middle">
                결측 대체 예측
                <InfoTooltip text={IMPUTED_TOOLTIP} label="결측 대체 예측 설명" />
              </span>{' '}
              {/* 예측은 도심만 해서 휴게소에는 대체 건수가 없음 (14번 API에 지역 구분도 없음) */}
              {region === 'service_area' ? (
                '· 휴게소는 예측 대상이 아닙니다'
              ) : data.imputed ? (
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
          </AdminPanel>
        </div>
      </div>
    </div>
  )
}
