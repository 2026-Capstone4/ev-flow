import { BottomTab } from '@/components/BottomTab'
import { HorizonSelector } from '@/components/HorizonSelector'
import { MapFallback } from '@/components/MapFallback'
import { RecommendCard } from '@/components/RecommendCard'
import { SearchBar } from '@/components/SearchBar'
import { UpdateStatus } from '@/components/UpdateStatus'
import { useMapHomeData } from '@/hooks/useMapHomeData'
import { useMyLocationMarker, useStationMarkers } from '@/hooks/useMapMarkers'
import { useNaverMap } from '@/hooks/useNaverMap'
import { DEMO_USER_LOCATION, MAPO_CENTER } from '@/lib/constants'

const RECOMMEND_MESSAGE = {
  error: '추천 충전소를 불러오지 못했습니다',
  empty: '추천할 충전소가 없습니다',
}

export function MapHomePage() {
  const { containerRef, map, status } = useNaverMap({ center: MAPO_CENTER, zoom: 13 })
  const {
    horizon,
    setHorizon,
    stations,
    updatedAt,
    isStationsError,
    topRecommendation,
    recommendState,
  } = useMapHomeData(DEMO_USER_LOCATION)

  // TODO(fe): 마커 클릭 시 충전소 상세(03) 연결
  useStationMarkers(map, stations)
  useMyLocationMarker(map, DEMO_USER_LOCATION)

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col overflow-hidden bg-bg-map">
      <main className="relative flex-1">
        {/* 지도: 네이버 지도가 컨테이너 position을 relative로 덮어써서 바깥 div로 크기 지정 */}
        <div className="absolute inset-0">
          <div ref={containerRef} className="size-full" aria-label="충전소 지도" />
        </div>
        {status !== 'ready' && <MapFallback status={status} />}

        {/* 상단 검색창 · 갱신 상태 */}
        <div className="absolute inset-x-4 top-[52px] flex flex-col items-start gap-2">
          {/* TODO(fe): 검색 · 필터 화면(04) 연결 */}
          <SearchBar />
          <UpdateStatus updatedAt={updatedAt} isError={isStationsError} />
        </div>

        {/* 하단 추천 시트 */}
        {/* TODO(fe): 시트 펼침 시 추천 Top 3 화면(02) 연결 */}
        <section className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 rounded-t-[20px] bg-bg-page px-4 pt-2.5 pb-4 shadow-[0_-2px_12px_rgba(0,0,0,0.12)]">
          <div className="h-1 w-10 rounded-[2px] bg-border-default" />
          <div className="flex w-full items-center justify-between">
            <h2 className="text-[17px] font-bold">추천 충전소</h2>
            <HorizonSelector value={horizon} onChange={setHorizon} />
          </div>
          {topRecommendation ? (
            <RecommendCard recommendation={topRecommendation} />
          ) : recommendState === 'error' || recommendState === 'empty' ? (
            <p className="flex h-[118px] w-full items-center justify-center rounded-lg bg-bg-subtle text-sm text-text-secondary">
              {RECOMMEND_MESSAGE[recommendState]}
            </p>
          ) : (
            <div className="h-[118px] w-full animate-pulse rounded-lg bg-bg-subtle" />
          )}
        </section>
      </main>
      <BottomTab />
    </div>
  )
}
