import { Info } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { BackButton } from '@/components/BackButton'
import { Button } from '@/components/Button'
import { ChargerRow } from '@/components/ChargerRow'
import { UpdateStatus } from '@/components/UpdateStatus'
import { useNoIndex, usePageTitle } from '@/hooks/usePageMeta'
import { useNow } from '@ev-flow/core/hooks/useNow'
import { useNationwideServiceAreaDetailData } from '@ev-flow/core/hooks/useNationwideServiceAreaDetailData'
import { detectPlatform, getNaverCarRouteUrl } from '@ev-flow/core/lib/naverMapLink'
import { openMapApp } from '@/lib/openMapApp'
import { AVAILABILITY_TONE_CLASS, getAvailabilityTone } from '@ev-flow/core/lib/serviceArea'

// 전국 휴게소 상세 (/service-areas/detail?id=). id는 15번 목록의 id(노선이 붙은 곳은 휴게소명, 못 붙인 곳은 statId)
// 노선 미확인을 묶은 휴게소는 id가 statId를 쉼표로 이은 값이라 statId마다 16번을 불러 합침 (core 훅이 처리)
// 휴게소는 앱 안 경로 미리보기가 없어서(POST /routes는 도심 충전소만) 길찾기 버튼이 바로 네이버 지도 앱을 엶
export function ServiceAreaDetailPage() {
  const [searchParams] = useSearchParams()
  const id = searchParams.get('id') ?? ''
  const now = useNow()
  const { serviceArea, chargerGroups, unknownCount, updatedAt, isError, isNotFound } =
    useNationwideServiceAreaDetailData(id)
  // 휴게소 이름이 검색 결과 제목이 됨. 없는 휴게소는 색인하지 않음
  usePageTitle(serviceArea ? serviceArea.name : isNotFound ? '휴게소를 찾을 수 없어요' : undefined)
  useNoIndex(isNotFound)

  const platform = detectPlatform(navigator.userAgent)
  // 휴게소 정보를 받은 뒤에만 목적지를 알 수 있어 그 전엔 null
  const naverMapUrl = serviceArea
    ? getNaverCarRouteUrl(
        {
          destination: { lat: serviceArea.lat, lng: serviceArea.lng, name: serviceArea.name },
          appName: window.location.origin,
        },
        platform,
      )
    : null

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col bg-bg-page">
      <header className="flex h-[52px] shrink-0 items-center gap-2 px-4">
        <BackButton />
        <h1 className="text-[18px] font-bold">휴게소 상세</h1>
      </header>

      {serviceArea && chargerGroups ? (
        <>
          <main className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pt-2 pb-8">
            <section className="flex flex-col items-start gap-1.5">
              <h2 className="text-[22px] font-bold">{serviceArea.name}</h2>
              <p className="text-sm text-text-secondary">
                {serviceArea.routeName ?? '노선 미확인'} · 급속 {serviceArea.totalChargers}기
              </p>
              <UpdateStatus updatedAt={updatedAt} isError={isError} />
            </section>

            <p className="flex gap-2 rounded-sm bg-bg-subtle px-3 py-2.5 text-[14px] text-text-secondary">
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
                    <h4 className="text-[14px] font-medium text-text-secondary">{operator}</h4>
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

          <footer className="shrink-0 border-t border-border-default px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            {/* 휴대폰은 네이버 지도 앱, PC는 네이버 지도 웹을 새 탭으로 엶 */}
            {naverMapUrl && (
              <Button className="w-full" onClick={() => openMapApp(naverMapUrl, platform, 'naver')}>
                네이버 지도로 길찾기
              </Button>
            )}
          </footer>
        </>
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
