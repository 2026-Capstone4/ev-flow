import { ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { BackButton } from '@/components/BackButton'
import { DistrictPicker } from '@/components/DistrictPicker'
import { FilterChip } from '@/components/FilterChip'
import { UpdateStatus } from '@/components/UpdateStatus'
import { usePageTitle } from '@/hooks/usePageMeta'
import { useChargerIssuesData } from '@ev-flow/core/hooks/useChargerIssuesData'
import { useMapView } from '@ev-flow/core/hooks/useMapView'
import { CHARGER_STATUS_LABEL, formatChargerSpec } from '@ev-flow/core/lib/charger'
import {
  ALL_DISTRICTS,
  type ChargerIssueFilter,
  type StationChargerIssues,
} from '@ev-flow/core/lib/chargerIssues'

/** 칩 순서와 이름 */
const FILTER_OPTIONS: { value: ChargerIssueFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'unknown', label: '상태 미확인' },
  { value: 'unstable', label: '상태 불안정' },
]

type SectionProps = {
  title: string
  count: number
  description: ReactNode
  children: ReactNode
}

/** 목록 한 묶음 (제목 · 대수 · 설명 · 충전소 카드들) */
function Section({ title, count, description, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold">
          {title} <span className="text-text-secondary">{count}기</span>
        </h2>
        <p className="text-[13px] break-keep text-text-secondary">{description}</p>
      </div>
      {children}
    </section>
  )
}

type StationIssueCardProps = {
  station: StationChargerIssues
  /** 충전기 행 오른쪽 상태 문구. 목록의 충전기는 모두 지금 확인 불가라 카드마다 하나 */
  statusLabel: string
  onClick: (stationId: string) => void
}

/** 충전소 한 곳의 상태 이상 충전기. 위쪽 충전소 이름을 누르면 충전소 상세로 감 */
function StationIssueCard({ station, statusLabel, onClick }: StationIssueCardProps) {
  return (
    <div className="overflow-hidden rounded-md border border-border-default">
      <button
        type="button"
        aria-label={`${station.name} 상세 보기`}
        onClick={() => onClick(station.stationId)}
        className="flex w-full items-center gap-2 border-b border-border-default bg-bg-subtle px-4 py-2.5 text-left active:opacity-70"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-bold">{station.name}</span>
          <span className="truncate text-xs text-text-secondary">{station.address}</span>
        </span>
        <ChevronRight aria-hidden size={18} className="shrink-0 text-text-secondary" />
      </button>
      <ul>
        {station.chargers.map((charger) => (
          <li
            key={charger.chargerId}
            className="flex items-center justify-between gap-2 border-b border-border-default px-4 py-2.5 last:border-b-0"
          >
            <span className="min-w-0 text-[13px] font-medium break-keep">
              급속 {charger.chargerId} ·{' '}
              {formatChargerSpec(charger.connectorTypes, charger.capacityKw)}
            </span>
            <span className="shrink-0 text-[13px] font-bold text-congestion-unknown">
              {statusLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 목록이 비었을 때 칸 */
function EmptyRow({ message }: { message: string }) {
  return (
    <p className="rounded-md bg-bg-subtle py-5 text-center text-sm text-text-secondary">
      {message}
    </p>
  )
}

// 상태 이상 충전기 목록 (앱 charger-issues 화면과 같음). 지도 홈 검색창 아래 '상태 이상' 버튼으로 들어옴
// 미확인 = 지금 상태를 알 수 없는 충전기, 불안정 = 원천 데이터 문제로 상태가 계속 바뀌는 정해진 충전기 중 지금 확인 불가인 것
// 처음에는 서울 전체를 보여 주고, 구를 고르면 그 구만. 화면을 나가면 고른 구 · 칩은 초기화됨
export function ChargerIssuesPage() {
  const navigate = useNavigate()
  const { horizon } = useMapView()
  usePageTitle('상태 이상 충전기')

  // 보여 줄 구. 처음에는 서울 전체('전체')로 시작함
  const [district, setDistrict] = useState<string>(ALL_DISTRICTS)
  const [filter, setFilter] = useState<ChargerIssueFilter>('all')

  // 고른 구의 목록을 받음
  const { issues, districts, updatedAt, isError, isAllUnknown } = useChargerIssuesData(district)

  // 충전소 상세로. 지도 홈에서 보던 시점을 그대로 넘김
  const openStation = (stationId: string) => navigate(`/stations/${stationId}?horizon=${horizon}`)

  /** 받은 데이터 상태에 따라 본문을 고름 */
  const renderBody = () => {
    // 아직 못 받았으면 실패 안내 또는 빈 자리
    if (!issues) {
      // 처음 불러오기가 실패했으면 안내, 아니면 불러오는 동안 회색 상자
      if (isError) {
        return (
          <p className="pt-16 text-center text-sm text-text-secondary">
            충전기 정보를 불러오지 못했습니다
          </p>
        )
      }
      return (
        <div className="flex animate-pulse flex-col gap-3">
          <div className="h-5 w-1/2 rounded-sm bg-bg-subtle" />
          <div className="h-24 rounded-md bg-bg-subtle" />
          <div className="h-24 rounded-md bg-bg-subtle" />
        </div>
      )
    }
    // 수집이 오래 끊기면 모든 충전기가 확인 불가라 목록 대신 안내만
    if (isAllUnknown) {
      return (
        <p className="rounded-md bg-status-warning-bg px-4 py-3 text-sm font-medium break-keep text-status-warning">
          상태 수집이 늦어지고 있어요.
          <br />
          지금은 모든 충전기 상태를 확인할 수 없어요.
        </p>
      )
    }

    const counts: Record<ChargerIssueFilter, number> = {
      all: issues.unknownCount + issues.unstableCount,
      unknown: issues.unknownCount,
      unstable: issues.unstableCount,
    }
    // 고른 칩이 0대가 되면(다른 구로 바꾼 경우 등) 전체로 보여 줌
    const activeFilter = counts[filter] > 0 ? filter : 'all'
    // 미확인 칸은 전체 · 상태 미확인일 때 보임
    const showUnknown = activeFilter !== 'unstable'
    // 불안정 칸은 상태 불안정을 골랐거나, 전체인데 1대 이상일 때만 보임 (마포구 밖은 늘 0이라 숨김)
    const showUnstable =
      activeFilter === 'unstable' || (activeFilter === 'all' && issues.unstableCount > 0)

    return (
      <>
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              label={`${option.label} ${counts[option.value]}`}
              isSelected={option.value === activeFilter}
              // 0대인 칩은 골라도 볼 게 없어서 흐리게 두고 누를 수 없게 함 ('전체'는 늘 누를 수 있음)
              disabled={option.value !== 'all' && counts[option.value] === 0}
              onClick={() => setFilter(option.value)}
            />
          ))}
        </div>

        {showUnknown && (
          <Section
            title="상태 미확인 충전기"
            count={issues.unknownCount}
            description={
              <>
                통신이 끊겼거나 운영사가 상태를 보내지 않는 충전기예요.
                <br />
                현장 상태와 다를 수 있어요.
              </>
            }
          >
            {issues.unknown.length > 0 ? (
              issues.unknown.map((station) => (
                <StationIssueCard
                  key={station.stationId}
                  station={station}
                  statusLabel={CHARGER_STATUS_LABEL.unknown}
                  onClick={openStation}
                />
              ))
            ) : (
              <EmptyRow message="지금은 상태를 모르는 충전기가 없어요" />
            )}
          </Section>
        )}

        {showUnstable && (
          <Section
            title="상태 불안정 충전기"
            count={issues.unstableCount}
            description="운영사 정보 오류로 상태가 계속 바뀌는 충전기예요."
          >
            {issues.unstable.map((station) => (
              <StationIssueCard
                key={station.stationId}
                station={station}
                statusLabel="상태 자주 바뀜"
                onClick={openStation}
              />
            ))}
          </Section>
        )}
      </>
    )
  }

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col bg-bg-page">
      <header className="flex h-[52px] shrink-0 items-center gap-2 px-4">
        <BackButton />
        <h1 className="text-[17px] font-bold">상태 이상 충전기</h1>
      </header>
      <main className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pt-2 pb-6">
        {/* 갱신 시각 알약을 구 버튼 높이에 맞춤 */}
        <div className="flex flex-wrap items-stretch gap-2">
          <DistrictPicker value={district} districts={districts} onChange={setDistrict} />
          <UpdateStatus updatedAt={updatedAt} isError={isError} />
        </div>
        {renderBody()}
      </main>
    </div>
  )
}
