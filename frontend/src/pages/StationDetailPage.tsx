import { useNavigate, useParams, useSearchParams } from 'react-router'
import { BackButton } from '@/components/BackButton'
import { Button } from '@/components/Button'
import { ChargerRow } from '@/components/ChargerRow'
import { CongestionBadge } from '@/components/CongestionBadge'
import { HorizonSummary } from '@/components/HorizonSummary'
import { PredictionTile } from '@/components/PredictionTile'
import { UpdateStatus } from '@/components/UpdateStatus'
import { useNoIndex, usePageTitle } from '@/hooks/usePageMeta'
import { useNow } from '@ev-flow/core/hooks/useNow'
import { useStationDetailData } from '@ev-flow/core/hooks/useStationDetailData'
import { findPrediction, HORIZONS, parseHorizon } from '@ev-flow/core/lib/horizon'
import type { HorizonMinutes } from '@ev-flow/core/types/station'

export function StationDetailPage() {
  const navigate = useNavigate()
  const { stationId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const horizon = parseHorizon(searchParams.get('horizon'))
  const now = useNow()
  const { station, updatedAt, isError, isNotFound } = useStationDetailData(stationId, horizon)
  // 충전소 이름이 검색 결과 제목이 됨. 없어진 충전소는 색인하지 않음
  usePageTitle(station ? station.name : isNotFound ? '충전소를 찾을 수 없어요' : undefined)
  useNoIndex(isNotFound)

  const selectHorizon = (value: HorizonMinutes) =>
    setSearchParams({ horizon: String(value) }, { replace: true })

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col bg-bg-page">
      <header className="flex h-[52px] shrink-0 items-center gap-2 px-4">
        <BackButton />
        <h1 className="text-[18px] font-bold">충전소 상세</h1>
      </header>

      {station ? (
        <>
          <main className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pt-2 pb-6">
            <section className="flex flex-col gap-1.5">
              <h2 className="text-[22px] font-bold">{station.name}</h2>
              <p className="text-sm text-text-secondary">
                {station.address} · 급속 {station.totalChargers}기
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <CongestionBadge congestion={station.congestion} />
                <UpdateStatus updatedAt={updatedAt} isError={isError} />
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-bold">시간대별 혼잡 예측</h3>
              <div role="radiogroup" aria-label="예측 시점" className="flex gap-2">
                {HORIZONS.map((option) => {
                  const prediction = findPrediction(station, option)
                  // 서버가 이 시점 예측을 보내지 않았으면 칸을 그리지 않음
                  if (!prediction) return null
                  return (
                    <PredictionTile
                      key={option}
                      prediction={prediction}
                      isSelected={option === horizon}
                      onSelect={() => selectHorizon(option)}
                      // 지금 출발은 대기시간 대신 실시간 사용 가능 대수
                      caption={
                        option === 0
                          ? `${station.availableChargers}/${station.totalChargers}대`
                          : undefined
                      }
                    />
                  )
                })}
              </div>
            </section>

            {/* 세 시점 설명을 같은 자리에 겹쳐 그리고 고른 것만 보여 줌. 칸 높이가 셋 중 가장 큰 높이로 고정돼 시점을 바꿔도 충전기 현황이 움직이지 않음 */}
            <div className="grid">
              {HORIZONS.map((option) => (
                <div
                  key={option}
                  aria-hidden={option !== horizon}
                  className={`col-start-1 row-start-1 ${option === horizon ? '' : 'invisible'}`}
                >
                  <HorizonSummary station={station} horizon={option} />
                </div>
              ))}
            </div>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-bold">충전기 현황</h3>
              <ul className="overflow-hidden rounded-md border border-border-default">
                {station.chargers.map((charger) => (
                  <ChargerRow key={charger.chargerId} charger={charger} now={now} />
                ))}
              </ul>
            </section>
          </main>

          <footer className="shrink-0 border-t border-border-default px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <Button
              className="w-full"
              onClick={() => navigate(`/stations/${stationId}/route?horizon=${horizon}`)}
            >
              길찾기
            </Button>
          </footer>
        </>
      ) : isNotFound || isError ? (
        <p className="flex flex-1 items-center justify-center text-sm text-text-secondary">
          {isNotFound ? '충전소를 찾을 수 없습니다' : '충전소 정보를 불러오지 못했습니다'}
        </p>
      ) : (
        <div className="flex flex-col gap-3 px-4 pt-2">
          <div className="h-7 w-2/3 animate-pulse rounded-sm bg-bg-subtle" />
          <div className="h-5 w-1/2 animate-pulse rounded-sm bg-bg-subtle" />
          <div className="mt-4 h-24 animate-pulse rounded-md bg-bg-subtle" />
        </div>
      )}
    </div>
  )
}
