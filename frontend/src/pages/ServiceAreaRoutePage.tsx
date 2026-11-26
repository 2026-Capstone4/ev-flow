import { useNavigate, useSearchParams } from 'react-router'
import { BackButton } from '@/components/BackButton'
import { RouteBadge } from '@/components/RouteBadge'
import { ServiceAreaRow } from '@/components/ServiceAreaRow'
import { TabSwitch } from '@/components/TabSwitch'
import { UpdateStatus } from '@/components/UpdateStatus'
import { usePageTitle } from '@/hooks/usePageMeta'
import { toServiceAreaDetailPath } from '@/lib/serviceAreaPaths'
import { useServiceAreaRouteData } from '@ev-flow/core/hooks/useServiceAreaRouteData'
import { getRouteLabel, getTowardsNote } from '@ev-flow/core/lib/nationwideServiceArea'
import { NO_FORECAST_SERVICE_AREA_LABEL } from '@ev-flow/core/lib/serviceArea'

// 노선 화면 (/service-areas/route?name=경부선&heading=부산). 방향을 고르면 그 방향으로 지나가는 순서대로 휴게소를 보여 줌
export function ServiceAreaRoutePage() {
  const navigate = useNavigate()
  // 상세에서 돌아와도 고른 방향이 유지되도록 URL에 둠 (?heading=)
  const [searchParams, setSearchParams] = useSearchParams()
  const routeName = searchParams.get('name') ?? ''
  const {
    areas,
    headings,
    heading,
    routeNo,
    areaCount,
    availableChargers,
    updatedAt,
    isError,
    loadState,
  } = useServiceAreaRouteData(routeName, searchParams.get('heading'))
  // 지금 방향의 반대쪽 끝 도시 (예: 부산 방향이면 서울). '서울 → 부산 순서' 안내에 씀
  const origin = headings.find((h) => h !== heading)
  const title = `${getRouteLabel(routeName)}고속도로`
  usePageTitle(title)

  // 방향을 바꾸면 화면 기록을 쌓지 않고 URL의 값만 바꿈
  const changeHeading = (value: string) =>
    setSearchParams({ name: routeName, heading: value }, { replace: true })

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col bg-bg-subtle">
      <header className="flex h-[52px] shrink-0 items-center gap-2 px-4">
        <BackButton />
        <p className="text-[18px] font-bold">고속도로 휴게소</p>
      </header>

      <main className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-1 pb-6">
        <section className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <RouteBadge routeNo={routeNo} size="lg" />
            <h1 className="min-w-0 text-[22px] font-bold">{title}</h1>
          </div>
          {/* 노선 전체(두 방향 합계) 숫자는 목록을 받은 뒤에만 */}
          {areaCount !== undefined && (
            <p className="text-[14px] text-text-secondary">
              휴게소 {areaCount}곳 · 사용 가능 {availableChargers}기
            </p>
          )}
        </section>

        {/* 방향 버튼은 노선 끝 도시가 둘인 노선만. 순환선 등은 방향 없이 전체 목록 */}
        {heading && (
          <TabSwitch
            options={headings.map((h) => ({ value: h, label: `${h} 방향` }))}
            value={heading}
            onChange={changeHeading}
            label="방향"
          />
        )}
        <div className="flex items-center justify-between gap-2">
          <UpdateStatus updatedAt={updatedAt} isError={isError} />
          <span className="shrink-0 text-xs font-medium text-text-secondary">
            {NO_FORECAST_SERVICE_AREA_LABEL}
          </span>
        </div>
        {/* 방향이 있는 노선만 지나가는 순서를 안내 */}
        {heading && origin && (
          <p className="px-1 text-[14px] text-text-secondary">
            {origin} → {heading} 순서
          </p>
        )}

        {/* 받은 목록 · 불러오는 중 · 실패 또는 이 노선에 휴게소 없음 */}
        {loadState === 'ready' ? (
          <ul className="overflow-hidden rounded-lg bg-bg-page">
            {areas?.map((area, index) => (
              <ServiceAreaRow
                key={area.id}
                serviceArea={area}
                // 방향 탭 안에서는 방향을 뺀 이름, 방향 탭이 없는 노선은 방향이 들어간 이름
                title={heading ? area.shortName : area.name}
                note={area.bidirectional ? '양방향' : getTowardsNote(area, heading)}
                isFirst={index === 0}
                onClick={() => navigate(toServiceAreaDetailPath(area.id))}
              />
            ))}
          </ul>
        ) : loadState === 'loading' ? (
          <div className="h-[240px] shrink-0 animate-pulse rounded-lg bg-bg-page" />
        ) : (
          <p className="py-12 text-center text-sm text-text-secondary">
            {loadState === 'error'
              ? '휴게소 정보를 불러오지 못했습니다'
              : '이 노선에는 휴게소가 없습니다'}
          </p>
        )}
      </main>
    </div>
  )
}
