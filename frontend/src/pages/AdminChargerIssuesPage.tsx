import { useMemo, useState } from 'react'
import { AdminChargerIssueTable } from '@/components/AdminChargerIssueTable'
import { AdminPageHeader, AdminPanel, AdminPlaceholder } from '@/components/AdminPanel'
import { AdminRegionFilter } from '@/components/AdminRegionFilter'
import { FilterChip } from '@/components/FilterChip'
import { StatCard } from '@/components/StatCard'
import { UpdateStatus } from '@/components/UpdateStatus'
import { useAdminChargersQuery } from '@/hooks/useAdminQueries'
import {
  CHARGER_ISSUE_DESCRIPTION,
  CHARGER_ISSUE_KINDS,
  CHARGER_ISSUE_LABEL,
  countChargerIssues,
  countIssueStations,
  listChargerIssues,
  type ChargerIssueKind,
} from '@/lib/admin/chargerIssues'
import { toDistrictParam, type AdminRegionChoice } from '@/lib/admin/common'

/** 요약 카드 숫자 색 (표 종류 글자색과 같음). 0기면 기본 글자색 */
const CARD_VALUE_CLASS: Record<ChargerIssueKind, string> = {
  communication: 'text-congestion-busy',
  unconfirmed: 'text-status-warning',
  other: 'text-text-primary',
  unstable: 'text-text-secondary',
}

/** 요약 카드 아래 짧은 설명 */
const CARD_CAPTION: Record<ChargerIssueKind, string> = {
  communication: '원본 코드 1 · 바로 확인 필요',
  unconfirmed: '원본 코드 9',
  other: '코드 없음 · 수집 끊김 등',
  unstable: '9일 때만 셈 · 30분마다 바뀔 수 있음',
}

type IssueFilter = 'all' | ChargerIssueKind

/**
 * 상태 이상 충전기 모아보기 (운영자). 지금 확인 불가인 충전기를 종류별로 나눠 보여 줌
 * 데이터는 운영 현황과 같은 /admin/chargers — 같은 쿼리 키라 두 화면을 오가도 다시 받지 않음
 */
export function AdminChargerIssuesPage() {
  const [region, setRegion] = useState<AdminRegionChoice>('all')
  const [district, setDistrict] = useState('all')
  const [filter, setFilter] = useState<IssueFilter>('all')
  const query = useAdminChargersQuery(region, toDistrictParam(region, district))
  const data = query.data

  // 폴링 응답이 같으면 data가 그대로라 다시 계산하지 않음
  const issues = useMemo(() => (data ? listChargerIssues(data.chargers) : undefined), [data])
  const counts = issues ? countChargerIssues(issues) : undefined
  const updatedAt = data ? new Date(data.updatedAt) : null

  // 고른 칩이 0기가 되면(지역을 바꾼 경우 등) 전체로 보여 줌
  const activeFilter: IssueFilter = filter !== 'all' && counts?.[filter] === 0 ? 'all' : filter
  const visibleIssues =
    issues && (activeFilter === 'all' ? issues : issues.filter((i) => i.kind === activeFilter))

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <AdminPageHeader
        title="상태 이상 충전기"
        description="통신 이상 · 상태 미확인 · 상태 불안정 충전기 모아보기"
      >
        <AdminRegionFilter
          region={region}
          district={district}
          onRegionChange={setRegion}
          onDistrictChange={setDistrict}
        />
        {/* 다른 운영자 화면과 같은 두 줄 · 고정 폭 갱신 시각 */}
        <div className="flex h-11 min-w-[8.5rem]">
          <UpdateStatus
            updatedAt={updatedAt}
            isError={query.isError}
            twoLines
            className="w-full tabular-nums"
          />
        </div>
      </AdminPageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {CHARGER_ISSUE_KINDS.map((kind) => (
          <StatCard
            key={kind}
            label={CHARGER_ISSUE_LABEL[kind]}
            value={counts ? `${counts[kind]}기` : null}
            // 0기면 강조하지 않음
            valueClassName={counts?.[kind] ? CARD_VALUE_CLASS[kind] : 'text-text-primary'}
            caption={CARD_CAPTION[kind]}
          />
        ))}
      </div>

      <AdminPanel
        title="충전기 목록"
        aside={
          // 몇 곳의 몇 기인지 — 같은 충전소 충전기가 한꺼번에 끊긴 경우를 알아보기 쉬움
          visibleIssues && (
            <p className="text-[13px] text-text-secondary">
              {countIssueStations(visibleIssues)}곳 · {visibleIssues.length}기
            </p>
          )
        }
      >
        {issues && counts && updatedAt ? (
          <div className={`flex flex-col gap-4 ${query.isPlaceholderData ? 'opacity-40' : ''}`}>
            <div className="flex flex-col gap-2 px-5">
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  label={`전체 ${issues.length}`}
                  isSelected={activeFilter === 'all'}
                  onClick={() => setFilter('all')}
                />
                {CHARGER_ISSUE_KINDS.map((kind) => (
                  <FilterChip
                    key={kind}
                    label={`${CHARGER_ISSUE_LABEL[kind]} ${counts[kind]}`}
                    isSelected={activeFilter === kind}
                    // 0기인 종류는 골라도 볼 게 없어서 누를 수 없게 함
                    disabled={counts[kind] === 0}
                    onClick={() => setFilter(kind)}
                  />
                ))}
              </div>
              {/* 종류 하나를 고르면 그 종류가 무엇인지 한 줄로 설명 */}
              {activeFilter !== 'all' && (
                <p className="text-[13px] text-text-secondary">
                  {CHARGER_ISSUE_DESCRIPTION[activeFilter]}
                </p>
              )}
            </div>
            <AdminChargerIssueTable
              issues={visibleIssues ?? []}
              updatedAt={updatedAt}
              resetKey={`${region}-${district}-${activeFilter}`}
            />
          </div>
        ) : (
          <AdminPlaceholder isError={query.isError} height={480} />
        )}
      </AdminPanel>
    </div>
  )
}
