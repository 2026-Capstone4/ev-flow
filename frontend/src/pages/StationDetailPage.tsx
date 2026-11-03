import { useParams, useSearchParams } from 'react-router'
import { BackButton } from '@/components/BackButton'
import { Button } from '@/components/Button'
import { ChargerRow } from '@/components/ChargerRow'
import { CongestionBadge } from '@/components/CongestionBadge'
import { PredictionTile } from '@/components/PredictionTile'
import { UpdateStatus } from '@/components/UpdateStatus'
import { WaitRangeBar } from '@/components/WaitRangeBar'
import { useNow } from '@/hooks/useNow'
import { useStationDetailData } from '@/hooks/useStationDetailData'
import { formatWaitRange, NO_PREDICTION_LABEL } from '@/lib/congestion'
import { parseHorizon } from '@/lib/horizon'
import type { HorizonMinutes } from '@/types/station'

export function StationDetailPage() {
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
                {station.predictions.map((prediction) => (
                  <PredictionTile
                    key={prediction.horizonMinutes}
                    prediction={prediction}
                    isSelected={prediction.horizonMinutes === horizon}
                    onSelect={() => selectHorizon(prediction.horizonMinutes)}
                  />
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-bold">{horizon}분 후 예상 대기</h3>
              <p
                className={`font-bold ${waitRange ? 'text-[28px]' : 'text-lg text-text-secondary'}`}
              >
                {waitRange ?? NO_PREDICTION_LABEL}
              </p>
              {selectedPrediction?.waitTimeP50Minutes != null &&
                selectedPrediction.waitTimeP90Minutes != null && (
                  <WaitRangeBar
                    p50={selectedPrediction.waitTimeP50Minutes}
                    p90={selectedPrediction.waitTimeP90Minutes}
                  />
                )}
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-bold">충전기 현황</h3>
              <ul className="overflow-hidden rounded-md border border-border-default">
                {station.chargers.map((charger) => (
                  <ChargerRow key={charger.chargerId} charger={charger} now={now} />
                ))}
              </ul>
            </section>
          </main>

          <footer className="shrink-0 border-t border-border-default px-4 pt-3 pb-7">
            {/* TODO(fe): 길찾기 화면(05) 연결 — POST /routes */}
            <Button className="w-full">길찾기 (네이버 지도)</Button>
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
