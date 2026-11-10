import { useNavigate, useSearchParams } from 'react-router'
import { BottomTab } from '@/components/BottomTab'
import { DirectionSelector } from '@/components/DirectionSelector'
import { ServiceAreaCard } from '@/components/ServiceAreaCard'
import { UpdateStatus } from '@/components/UpdateStatus'
import { useServiceAreaListData } from '@/hooks/useServiceAreaListData'
import { NO_FORECAST_SERVICE_AREA_LABEL, parseDirection } from '@/lib/serviceArea'
import type { Direction } from '@/types/serviceArea'

export function ServiceAreaListPage() {
  const navigate = useNavigate()
  // 상세에서 뒤로 돌아와도 고른 방향이 유지되도록 URL에 둠
  const [searchParams, setSearchParams] = useSearchParams()
  const direction = parseDirection(searchParams.get('direction'))
  const { serviceAreas, totalCount, updatedAt, isError, loadState } =
    useServiceAreaListData(direction)

  const changeDirection = (value: Direction) =>
    setSearchParams({ direction: value }, { replace: true })

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col bg-bg-subtle">
      <main className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-[56px] pb-6">
        <header className="flex flex-col gap-0.5">
          <h1 className="text-[22px] font-bold">고속도로 휴게소</h1>
          <p className="text-[13px] text-text-secondary">
            천안 구간{totalCount !== undefined && ` ${totalCount}곳`} · 현재 충전기 현황
          </p>
        </header>
        <DirectionSelector value={direction} onChange={changeDirection} />
        <div className="flex items-center justify-between gap-2">
          <UpdateStatus updatedAt={updatedAt} isError={isError} />
          <span className="shrink-0 text-xs font-medium text-text-secondary">
            {NO_FORECAST_SERVICE_AREA_LABEL}
          </span>
        </div>

        {loadState === 'ready' ? (
          <ul className="flex flex-col gap-3">
            {serviceAreas?.map((area) => (
              <li key={`${area.name}-${area.direction}`}>
                <ServiceAreaCard
                  serviceArea={area}
                  onClick={() =>
                    navigate(
                      `/service-areas/detail?${new URLSearchParams({ name: area.name, direction })}`,
                    )
                  }
                />
              </li>
            ))}
          </ul>
        ) : loadState === 'loading' ? (
          <div className="h-[120px] animate-pulse rounded-lg bg-bg-page" />
        ) : (
          <p className="py-12 text-center text-sm text-text-secondary">
            {loadState === 'error'
              ? '휴게소 정보를 불러오지 못했습니다'
              : '이 방향에는 휴게소가 없습니다'}
          </p>
        )}
      </main>
      <BottomTab />
    </div>
  )
}
