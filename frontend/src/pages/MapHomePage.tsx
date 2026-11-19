import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { BottomTab } from '@/components/BottomTab'
import { DevZoomBadge } from '@/components/DevZoomBadge'
import { FilterPanel } from '@/components/FilterPanel'
import { HorizonSelector } from '@/components/HorizonSelector'
import { LocateButton } from '@/components/LocateButton'
import { MapFallback } from '@/components/MapFallback'
import { MapNotice } from '@/components/MapNotice'
import { OnboardingDialog } from '@/components/OnboardingDialog'
import { RecommendCard } from '@/components/RecommendCard'
import { SearchBar } from '@/components/SearchBar'
import { UpdateStatus } from '@/components/UpdateStatus'
import { ZoomInNotice } from '@/components/ZoomInNotice'
import { useCoverageMask } from '@/hooks/useCoverageMask'
import { useCurrentLocation } from '@/hooks/useCurrentLocation'
import { useMapHomeData } from '@/hooks/useMapHomeData'
import { useMyLocationMarker, useStationMarkers } from '@/hooks/useMapMarkers'
import { useNaverMap } from '@/hooks/useNaverMap'
import { useSheetCollapsedOffset } from '@/hooks/useSheetCollapsedOffset'
import { useSheetDrag } from '@/hooks/useSheetDrag'
import { useMapView } from '@/hooks/useMapView'
import { IS_GEOLOCATION_ENABLED, MAPO_CENTER } from '@/lib/constants'
import { LOCATE_FAILURE_MESSAGE } from '@/lib/geolocation'
import { hasSeenOnboarding, markOnboardingSeen } from '@/lib/onboarding'
import { countActiveFilters } from '@/lib/stationFilter'
import type { LatLng } from '@/types/geo'
import type { Station } from '@/types/station'

const RECOMMEND_MESSAGE = {
  error: '추천 충전소를 불러오지 못했습니다',
  empty: '추천할 충전소가 없습니다',
}

/** 안내 문구를 띄워 두는 시간 */
const NOTICE_DURATION_MS = 3000

export function MapHomePage() {
  const navigate = useNavigate()
  // 예측 시점 · 필터는 검색 화면과 함께 쓰고, 상세에서 뒤로 돌아와도 유지됨
  const { horizon, setHorizon, filters, setFilters, userLocation } = useMapView()
  // 길찾기 화면의 "다른 추천 충전소 보기"로 오면 추천 시트를 펼친 채로 시작
  const location = useLocation()
  const [isSheetExpanded, setIsSheetExpanded] = useState(
    () => (location.state as { expandSheet?: boolean } | null)?.expandSheet === true,
  )

  const { containerRef, map, status } = useNaverMap({ center: MAPO_CENTER, zoom: 14 })
  const {
    stations,
    allStations,
    updatedAt,
    isStationsError,
    recommendations,
    recommendedIds,
    recommendState,
  } = useMapHomeData(userLocation, horizon, filters)

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

  useCoverageMask(map)
  const { isZoomedOut } = useStationMarkers(map, stations, handleMarkerSelect, recommendedIds)
  useMyLocationMarker(map, userLocation)

  // 처음 들어온 사용자에게만 사용법 안내를 띄움. 본 기록은 브라우저(localStorage)에 남김
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => !hasSeenOnboarding())
  /** 안내를 닫으면 본 것으로 기록해서 다음 방문부터는 띄우지 않음 */
  const closeOnboarding = useCallback(() => {
    markOnboardingSeen()
    setIsOnboardingOpen(false)
  }, [])

  // 필터 버튼은 검색 화면으로 가지 않고 검색창 아래에 필터 패널을 엶. 지도는 덮지 않음
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const filterButtonAreaRef = useRef<HTMLDivElement>(null)
  // 패널이 바깥 누름 · Esc 감지를 다시 붙이지 않게 같은 함수를 넘김
  const closeFilter = useCallback(() => setIsFilterOpen(false), [])

  // 같은 문구가 연달아 와도 다시 3초를 세도록 띄울 때마다 id를 새로 붙임
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), NOTICE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [notice])

  const { locate, isLocating } = useCurrentLocation()
  const panTo = (target: LatLng) => map?.panTo(new window.naver.maps.LatLng(target.lat, target.lng))
  const handleLocate = async () => {
    // 기능이 꺼져 있으면 GPS 없이 지금 기준 위치(시연 위치)로 지도만 옮김
    if (!IS_GEOLOCATION_ENABLED) {
      panTo(userLocation)
      return
    }
    const result = await locate()
    // 찾았으면 그 위치로, 마포구 밖이면 지금 추천 기준 위치로 지도를 옮김
    if (result.ok || result.reason === 'out-of-area') {
      panTo(result.ok ? result.location : userLocation)
    }
    // 못 쓴 이유는 잠깐 안내 (권한 거부 · HTTPS 아님 · 마포구 밖 등)
    if (!result.ok) setNotice({ id: Date.now(), message: LOCATE_FAILURE_MESSAGE[result.reason] })
  }

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

        {/* 개발 모드에서만 지금 줌 표시. 배포 빌드에서는 코드째 빠짐 */}
        {import.meta.env.DEV && (
          <div className="absolute top-[76px] right-4">
            <DevZoomBadge map={map} />
          </div>
        )}

        {/* 상단 검색창 · 갱신 상태 */}
        <div className="absolute inset-x-4 top-4 flex flex-col items-start gap-2">
          {/* 패널은 검색창 기준으로 띄워서 아래 갱신 상태 · 안내를 밀어내지 않고 덮음 */}
          <div ref={filterButtonAreaRef} className="relative w-full">
            <SearchBar
              activeFilterCount={countActiveFilters(filters)}
              isFilterOpen={isFilterOpen}
              onSearchClick={() => navigate('/search')}
              onFilterClick={() => setIsFilterOpen(!isFilterOpen)}
            />
            {isFilterOpen && (
              <div className="absolute inset-x-0 top-full z-20 mt-2">
                <FilterPanel
                  filters={filters}
                  allStations={allStations}
                  ignoreRef={filterButtonAreaRef}
                  onClose={closeFilter}
                  onApply={(next) => {
                    setFilters(next)
                    setIsFilterOpen(false)
                  }}
                />
              </div>
            )}
          </div>
          <UpdateStatus updatedAt={updatedAt} isError={isStationsError} />
          {notice && <MapNotice key={notice.id} message={notice.message} />}
          {/* 너무 멀리 봐서 마커를 숨긴 동안은 확대하라고 계속 안내. 왼쪽 정렬 줄에서 혼자 가운데로 */}
          {isZoomedOut && (
            <div className="mt-2 self-center">
              <ZoomInNotice />
            </div>
          )}
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
          className={`absolute inset-x-0 bottom-0 flex max-h-[calc(100%-120px)] flex-col items-center gap-3 rounded-t-[20px] bg-bg-page px-4 pt-2.5 pb-3 shadow-[0_-2px_12px_rgba(0,0,0,0.12)] ${
            isSheetAnimating && !sheetDrag.isDragging
              ? 'transition-transform duration-200 ease-out'
              : ''
          }`}
        >
          {/* 현재 위치 버튼. 시트 위에 붙어 함께 움직이고, 시트를 펼치면 숨김 */}
          <div
            style={{ opacity: 1 - expandProgress }}
            className={`absolute right-4 bottom-full mb-3 ${isSheetExpanded ? 'pointer-events-none' : ''} ${
              isSheetAnimating && !sheetDrag.isDragging ? 'transition-opacity duration-200' : ''
            }`}
          >
            <LocateButton
              isLocating={isLocating}
              onClick={handleLocate}
              tabIndex={isSheetExpanded ? -1 : undefined}
            />
          </div>
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
              {/* 앞의 형광 파란 점은 지도에서 추천 충전소 마커 색과 같음 (범례) */}
              <h2 className="flex items-center gap-1.5 text-[17px] font-bold">
                <span aria-hidden className="size-2.5 rounded-full bg-marker-recommended" />
                추천 충전소
              </h2>
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
      {isOnboardingOpen && <OnboardingDialog onClose={closeOnboarding} />}
    </div>
  )
}
