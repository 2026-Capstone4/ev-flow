import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { BottomTab } from '@/components/BottomTab'
import { HorizonSelector } from '@/components/HorizonSelector'
import { MapFallback } from '@/components/MapFallback'
import { RecommendCard } from '@/components/RecommendCard'
import { SearchBar } from '@/components/SearchBar'
import { UpdateStatus } from '@/components/UpdateStatus'
import { useMapHomeData } from '@/hooks/useMapHomeData'
import { useMyLocationMarker, useStationMarkers } from '@/hooks/useMapMarkers'
import { useNaverMap } from '@/hooks/useNaverMap'
import { useSheetCollapsedOffset } from '@/hooks/useSheetCollapsedOffset'
import { useSheetDrag } from '@/hooks/useSheetDrag'
import { useMapView } from '@/hooks/useMapView'
import { DEMO_USER_LOCATION, MAPO_CENTER } from '@/lib/constants'
import { countActiveFilters } from '@/lib/stationFilter'
import type { Station } from '@/types/station'

const RECOMMEND_MESSAGE = {
  error: '추천 충전소를 불러오지 못했습니다',
  empty: '추천할 충전소가 없습니다',
}

export function MapHomePage() {
  const navigate = useNavigate()
  // 예측 시점 · 필터는 검색 화면과 함께 쓰고, 상세에서 뒤로 돌아와도 유지됨
  const { horizon, setHorizon, filters } = useMapView()
  // 길찾기 화면의 "다른 추천 충전소 보기"로 오면 추천 시트를 펼친 채로 시작
  const location = useLocation()
  const [isSheetExpanded, setIsSheetExpanded] = useState(
    () => (location.state as { expandSheet?: boolean } | null)?.expandSheet === true,
  )

  const { containerRef, map, status } = useNaverMap({ center: MAPO_CENTER, zoom: 13 })
  const { stations, updatedAt, isStationsError, recommendations, recommendState } = useMapHomeData(
    DEMO_USER_LOCATION,
    horizon,
    filters,
  )

  // 마커는 시점이 바뀔 때마다 다시 만들지 않도록 최신 시점만 ref로 읽음
  const horizonRef = useRef(horizon)
  useEffect(() => {
    horizonRef.current = horizon
  }, [horizon])
  const openStation = useCallback(
    (stationId: string) => navigate(`/stations/${stationId}?horizon=${horizonRef.current}`),
    [navigate],
  )
  const handleMarkerSelect = useCallback(
    (station: Station) => openStation(station.stationId),
    [openStation],
  )

  useStationMarkers(map, stations, handleMarkerSelect)
  useMyLocationMarker(map, DEMO_USER_LOCATION)

  // 펼침 · 접힘 · 손 뗐을 때만 애니메이션. 데이터가 와서 높이를 처음 잴 때 시트가 미끄러져 내려오지 않게 함
  const [isSheetAnimating, setIsSheetAnimating] = useState(false)
  const setSheetExpanded = (expanded: boolean) => {
    setIsSheetAnimating(true)
    setIsSheetExpanded(expanded)
  }
  const sheetDrag = useSheetDrag({
    onDragUp: () => setSheetExpanded(true),
    onDragDown: () => setSheetExpanded(false),
    onRelease: () => setIsSheetAnimating(true),
  })
  // 시트는 항상 Top 3를 다 그리고, 접힌 상태에서는 첫 카드만 보이게 아래로 내려 둠
  const sheetRef = useRef<HTMLElement>(null)
  const [firstItem, setFirstItem] = useState<HTMLLIElement | null>(null)
  const collapsedOffset = useSheetCollapsedOffset(sheetRef, firstItem)
  const sheetTranslate = Math.min(
    Math.max((isSheetExpanded ? 0 : collapsedOffset) + sheetDrag.dragOffset, 0),
    collapsedOffset,
  )
  /** 0 = 접힘, 1 = 펼침. 지도 어둡게 하는 정도에 씀 */
  const expandProgress = collapsedOffset ? 1 - sheetTranslate / collapsedOffset : 0

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col overflow-hidden bg-bg-map">
      {/* 아래로 내려 둔 시트가 하단 탭 위로 겹치지 않게 잘라냄 */}
      <main className="relative flex-1 overflow-hidden">
        {/* 지도: 네이버 지도가 컨테이너 position을 relative로 덮어써서 바깥 div로 크기 지정 */}
        <div className="absolute inset-0">
          <div ref={containerRef} className="size-full" aria-label="충전소 지도" />
        </div>
        {status !== 'ready' && <MapFallback status={status} />}

        {/* 상단 검색창 · 갱신 상태 */}
        <div className="absolute inset-x-4 top-[52px] flex flex-col items-start gap-2">
          <SearchBar
            activeFilterCount={countActiveFilters(filters)}
            onClick={() => navigate('/search')}
          />
          <UpdateStatus updatedAt={updatedAt} isError={isStationsError} />
        </div>

        <button
          type="button"
          aria-label="추천 목록 닫기"
          tabIndex={isSheetExpanded ? 0 : -1}
          onClick={() => setSheetExpanded(false)}
          style={{ opacity: expandProgress }}
          className={`absolute inset-0 bg-black/25 ${isSheetExpanded ? '' : 'pointer-events-none'} ${
            isSheetAnimating && !sheetDrag.isDragging ? 'transition-opacity duration-200' : ''
          }`}
        />

        {/* 하단 추천 시트. 펼치면 Top 3 (02) */}
        <section
          ref={sheetRef}
          style={{ transform: `translateY(${sheetTranslate}px)` }}
          onTransitionEnd={(event) => {
            if (event.target === event.currentTarget) setIsSheetAnimating(false)
          }}
          className={`absolute inset-x-0 bottom-0 flex max-h-[calc(100%-120px)] flex-col items-center gap-3 rounded-t-[20px] bg-bg-page px-4 pt-2.5 pb-4 shadow-[0_-2px_12px_rgba(0,0,0,0.12)] ${
            isSheetAnimating && !sheetDrag.isDragging
              ? 'transition-transform duration-200 ease-out'
              : ''
          }`}
        >
          {/* 손잡이 · 헤더를 끌어 펼치고 접음. 카드 영역은 탭으로 상세 이동이라 제외 */}
          <div
            onPointerDown={sheetDrag.onPointerDown}
            className="flex w-full touch-none flex-col items-center gap-3 select-none"
          >
            <button
              type="button"
              aria-label={isSheetExpanded ? '추천 목록 접기' : '추천 목록 펼치기'}
              aria-expanded={isSheetExpanded}
              onClick={sheetDrag.ignoreClickAfterDrag(() => setSheetExpanded(!isSheetExpanded))}
              className="-my-2.5 flex w-full justify-center py-2.5"
            >
              <span className="h-1 w-10 rounded-[2px] bg-border-default" />
            </button>
            <div className="flex w-full items-center justify-between">
              <h2 className="text-[17px] font-bold">추천 충전소</h2>
              <HorizonSelector value={horizon} onChange={setHorizon} />
            </div>
          </div>
          {recommendations?.length ? (
            <ul
              className={`flex w-full flex-col gap-3 ${isSheetExpanded ? 'overflow-y-auto' : 'overflow-hidden'}`}
            >
              {recommendations.map((recommendation, index) => (
                <li
                  key={recommendation.station.stationId}
                  ref={index === 0 ? setFirstItem : undefined}
                  // 접혀서 가려진 카드는 키보드 · 스크린리더에서도 숨김 (React 18은 inert 미지원)
                  aria-hidden={!isSheetExpanded && index > 0}
                >
                  <RecommendCard
                    tabIndex={!isSheetExpanded && index > 0 ? -1 : undefined}
                    recommendation={recommendation}
                    onClick={() => openStation(recommendation.station.stationId)}
                  />
                </li>
              ))}
              {/* 후보가 3곳 미만이면 짧은 배열로 옴 (UC-U06 E1) */}
              {recommendations.length < 3 && (
                <li className="text-center text-[13px] text-text-secondary">
                  조건에 맞는 후보가 {recommendations.length}곳뿐이에요
                </li>
              )}
            </ul>
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
