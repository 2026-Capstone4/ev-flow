import { useNavigate, useParams, useSearchParams } from 'react-router'
import { BackButton } from '@/components/BackButton'
import { Button } from '@/components/Button'
import { ChargerRow } from '@/components/ChargerRow'
import { ChargerStatusBar } from '@/components/ChargerStatusBar'
import { CongestionBadge } from '@/components/CongestionBadge'
import { PredictionTile } from '@/components/PredictionTile'
import { UpdateStatus } from '@/components/UpdateStatus'
import { WaitRangeBar } from '@/components/WaitRangeBar'
import { useNow } from '@ev-flow/core/hooks/useNow'
import { useStationDetailData } from '@ev-flow/core/hooks/useStationDetailData'
import { formatWaitRange } from '@ev-flow/core/lib/congestion'
import { findPrediction, getHorizonWhen, HORIZONS, parseHorizon } from '@ev-flow/core/lib/horizon'
import type { HorizonMinutes } from '@ev-flow/core/types/station'

export function StationDetailPage() {
  const navigate = useNavigate()
  const { stationId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const horizon = parseHorizon(searchParams.get('horizon'))
  const now = useNow()
  const { station, updatedAt, isError, isNotFound, selectedPrediction } = useStationDetailData(
    stationId,
    horizon,
  )

  const selectHorizon = (value: HorizonMinutes) =>
    setSearchParams({ horizon: String(value) }, { replace: true })

  const waitRange = selectedPrediction
    ? formatWaitRange(selectedPrediction.waitTimeP50Minutes, selectedPrediction.waitTimeP90Minutes)
    : null

  // 충전기가 모두 확인 불가면 빈 충전기가 없는 게 아니라 상태를 모르는 것
  const isAllUnknown =
    !!station &&
    station.chargers.length > 0 &&
    station.chargers.every((c) => c.status === 'unknown')

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col bg-bg-page">
      <header className="flex h-[52px] shrink-0 items-center gap-2 px-4">
        <BackButton />
        <h1 className="text-[17px] font-bold">충전소 상세</h1>
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

            {/* 지금 출발은 예상 대기 대신 실시간 사용 가능 대수와 상태 막대 */}
            {horizon === 0 ? (
              <section className="flex flex-col gap-3">
                <h3 className="text-base font-bold">지금 사용 가능</h3>
                {/* 빈 충전기가 있으면 대수를 크게, 모두 확인 불가면 상태를 못 받았다고 안내, 그 밖에는 15 · 30분 예측을 보도록 안내 */}
                {station.availableChargers > 0 ? (
                  <p className="font-bold">
                    <span className="text-[28px]">{station.availableChargers}대</span>
                    <span className="text-sm text-text-secondary">
                      {' '}
                      / 전체 {station.totalChargers}대
                    </span>
                  </p>
                ) : isAllUnknown ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-lg font-bold text-text-secondary">상태 확인 불가</p>
                    <p className="text-[13px] text-text-secondary">
                      지금은 충전기 상태를 받아오지 못했어요
                      <br />
                      15분 후 · 30분 후 예측을 참고해보세요
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <p className="text-lg font-bold text-text-secondary">빈 충전기 없음</p>
                    <p className="text-[13px] text-text-secondary">
                      15분 후 · 30분 후의 예상 대기시간을 확인해보세요
                    </p>
                  </div>
                )}
                <ChargerStatusBar statuses={station.chargers.map((c) => c.status)} />
              </section>
            ) : waitRange ? (
              // 15 · 30분은 대기 예측이 있을 때만 보여 줌. 기준선이거나 대기 모델이 꺼져 있으면 혼잡 예측 칸만 남김
              <section className="flex flex-col gap-3">
                <h3 className="text-base font-bold">{getHorizonWhen(horizon)} 예상 대기</h3>
                <p className="text-[28px] font-bold">{waitRange}</p>
                {selectedPrediction?.waitTimeP50Minutes != null &&
                  selectedPrediction.waitTimeP90Minutes != null && (
                    <WaitRangeBar
                      p50={selectedPrediction.waitTimeP50Minutes}
                      p90={selectedPrediction.waitTimeP90Minutes}
                    />
                  )}
              </section>
            ) : null}

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
