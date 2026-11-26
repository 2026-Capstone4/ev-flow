import { useNavigate, useSearchParams } from 'react-router'
import { BackButton } from '@/components/BackButton'
import { RouteBadge } from '@/components/RouteBadge'
import { ServiceAreaRow } from '@/components/ServiceAreaRow'
import { UpdateStatus } from '@/components/UpdateStatus'
import { usePageTitle } from '@/hooks/usePageMeta'
import { toServiceAreaDetailPath } from '@/lib/serviceAreaPaths'
import { useServiceAreaRegionData } from '@ev-flow/core/hooks/useServiceAreaRegionData'
import { NO_FORECAST_SERVICE_AREA_LABEL } from '@ev-flow/core/lib/serviceArea'

// 지역 화면 (/service-areas/region?code=41). 한 시도의 휴게소를 노선별 소제목으로 묶고, 노선 미확인은 맨 아래
// code=unmatched면 노선 미확인 휴게소를 시도별 소제목으로 묶음 (노선별 탭의 '노선 미확인' 줄)
// 방향 탭이 없어서 휴게소 이름은 방향이 들어간 name을 씀
export function ServiceAreaRegionPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { title, sections, areaCount, availableChargers, updatedAt, isError, loadState } =
    useServiceAreaRegionData(searchParams.get('code') ?? '')
  // 브라우저 탭 제목 (예: 경기도 휴게소). 노선 미확인은 제목에 이미 휴게소가 들어 있음
  usePageTitle(title.endsWith('휴게소') ? title : `${title} 휴게소`)

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col bg-bg-subtle">
      <header className="flex h-[52px] shrink-0 items-center gap-2 px-4">
        <BackButton />
        <p className="text-[18px] font-bold">고속도로 휴게소</p>
      </header>

      <main className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-1 pb-6">
        <section className="flex flex-col gap-1">
          <h1 className="text-[22px] font-bold">{title}</h1>
          {/* 휴게소 수 · 사용 가능 수는 목록을 받은 뒤에만 */}
          {areaCount !== undefined && (
            <p className="text-[14px] text-text-secondary">
              휴게소 {areaCount}곳 · 사용 가능 {availableChargers}기
            </p>
          )}
        </section>
        <div className="flex items-center justify-between gap-2">
          <UpdateStatus updatedAt={updatedAt} isError={isError} />
          <span className="shrink-0 text-xs font-medium text-text-secondary">
            {NO_FORECAST_SERVICE_AREA_LABEL}
          </span>
        </div>

        {/* 받은 목록 · 불러오는 중 · 실패 또는 이 지역에 휴게소 없음 */}
        {loadState === 'ready' ? (
          sections?.map((section) => (
            <section key={section.title} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1 pt-2">
                <RouteBadge routeNo={section.routeNo} />
                <h2 className="text-[16px] font-bold">{section.title}</h2>
                <span className="text-[14px] text-text-secondary">{section.areas.length}곳</span>
              </div>
              <ul
                // overflow-hidden(둥근 모서리 자르기)이 있으면 세로 flex에서 목록이 화면 높이로 줄어 잘림 → shrink-0으로 막아 바깥이 스크롤되게 함
                className="shrink-0 overflow-hidden rounded-lg bg-bg-page"
              >
                {section.areas.map((area, index) => (
                  <ServiceAreaRow
                    key={area.id}
                    serviceArea={area}
                    title={area.name}
                    note={area.bidirectional ? '양방향' : null}
                    isFirst={index === 0}
                    onClick={() => navigate(toServiceAreaDetailPath(area.id))}
                  />
                ))}
              </ul>
            </section>
          ))
        ) : loadState === 'loading' ? (
          <div className="h-[240px] shrink-0 animate-pulse rounded-lg bg-bg-page" />
        ) : (
          <p className="py-12 text-center text-sm text-text-secondary">
            {loadState === 'error'
              ? '휴게소 정보를 불러오지 못했습니다'
              : '이 지역에는 휴게소가 없습니다'}
          </p>
        )}
      </main>
    </div>
  )
}
