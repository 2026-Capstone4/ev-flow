import { Info } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { BackButton } from '@/components/BackButton'
import { ChargerRow } from '@/components/ChargerRow'
import { DirectionTag } from '@/components/DirectionTag'
import { UpdateStatus } from '@/components/UpdateStatus'
import { useNow } from '@/hooks/useNow'
import { useServiceAreaDetailData } from '@/hooks/useServiceAreaDetailData'
import { AVAILABILITY_TONE_CLASS, getAvailabilityTone, parseDirection } from '@/lib/serviceArea'

// 명세상 휴게소는 길찾기를 제공하지 않아(POST /routes는 도심 충전소만) Figma 08의 길찾기 버튼은 넣지 않음
export function ServiceAreaDetailPage() {
  const [searchParams] = useSearchParams()
  const name = searchParams.get('name') ?? ''
  const direction = parseDirection(searchParams.get('direction'))
  const now = useNow()
  const { serviceArea, chargerGroups, unknownCount, updatedAt, isError, isNotFound } =
    useServiceAreaDetailData(name, direction)

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col bg-bg-page">
      <header className="flex h-[52px] shrink-0 items-center gap-2 px-4">
        <BackButton />
        <h1 className="text-[17px] font-bold">휴게소 상세</h1>
      </header>

      {serviceArea && chargerGroups ? (
        <main className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pt-2 pb-8">
          <section className="flex flex-col items-start gap-1.5">
            <div className="flex items-center gap-2">
              <h2 className="text-[22px] font-bold">{serviceArea.name}</h2>
              <DirectionTag direction={serviceArea.direction} />
            </div>
            <p className="text-sm text-text-secondary">
              {serviceArea.route}선 · 급속 {serviceArea.totalChargers}기
            </p>
            <UpdateStatus updatedAt={updatedAt} isError={isError} />
          </section>

          <p className="flex gap-2 rounded-sm bg-bg-subtle px-3 py-2.5 text-[13px] text-text-secondary">
            <Info aria-hidden size={16} strokeWidth={2} className="mt-px shrink-0" />
            휴게소는 현재 충전기 현황만 보여줘요. 혼잡 예측과 예상 대기는 도심 충전소에서만
            제공해요.
          </p>

          <section className="flex flex-col gap-1.5">
            <h3 className="text-base font-bold">지금 사용 가능</h3>
            <p className="flex items-baseline gap-1.5">
              <span
                className={`text-[32px] font-bold ${
                  AVAILABILITY_TONE_CLASS[
                    getAvailabilityTone(
                      serviceArea.availableChargers,
                      serviceArea.totalChargers,
                      unknownCount,
                    )
                  ]
                }`}
              >
                {serviceArea.availableChargers}대
              </span>
              <span className="text-base text-text-secondary">
                / 급속 {serviceArea.totalChargers}기
              </span>
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-base font-bold">충전기 현황</h3>
            {chargerGroups.map(({ operator, stations }) => (
              <div key={operator} className="flex flex-col gap-2">
                {/* 운영기관이 하나면 묶음 제목은 생략 */}
                {chargerGroups.length > 1 && (
                  <h4 className="text-[13px] font-medium text-text-secondary">{operator}</h4>
                )}
                {/* 충전기 번호가 충전소마다 01부터라 충전소별로 상자를 나눠 번호 중복을 구분 */}
                {stations.map(({ stationId, chargers }) => (
                  <ul
                    key={stationId}
                    className="overflow-hidden rounded-md border border-border-default"
                  >
                    {chargers.map((charger) => (
                      <ChargerRow key={charger.chargerId} charger={charger} now={now} />
                    ))}
                  </ul>
                ))}
              </div>
            ))}
          </section>
        </main>
      ) : isNotFound || isError ? (
        <p className="flex flex-1 items-center justify-center text-sm text-text-secondary">
          {isNotFound ? '휴게소를 찾을 수 없습니다' : '휴게소 정보를 불러오지 못했습니다'}
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
