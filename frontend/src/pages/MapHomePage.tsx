import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { AppInstallSheet } from '@/components/AppInstallSheet'
import { BottomTab } from '@/components/BottomTab'
import { DevZoomBadge } from '@/components/DevZoomBadge'
import { ChargerIssuesButton } from '@/components/ChargerIssuesButton'
import { FilterPanel } from '@/components/FilterPanel'
import { HorizonSelector } from '@/components/HorizonSelector'
import { LocateButton } from '@/components/LocateButton'
import { MapFallback } from '@/components/MapFallback'
import { MapNotice } from '@/components/MapNotice'
import { OnboardingDialog } from '@/components/OnboardingDialog'
import {
  RECOMMEND_CARD_HEIGHT_CLASS,
  RecommendCard,
  RecommendCardSkeleton,
} from '@/components/RecommendCard'
import { SearchBar } from '@/components/SearchBar'
import { UpdateStatus } from '@/components/UpdateStatus'
import { ZoomInNotice } from '@/components/ZoomInNotice'
import { useCoverageMask } from '@/hooks/useCoverageMask'
import { useCurrentLocation } from '@/hooks/useCurrentLocation'
import { useLocationTracking } from '@/hooks/useLocationTracking'
import { useMapHomeData } from '@ev-flow/core/hooks/useMapHomeData'
import { useMyLocationMarker, useStationMarkers } from '@/hooks/useMapMarkers'
import { useNaverMap } from '@/hooks/useNaverMap'
import { useSheetCollapsedOffset } from '@/hooks/useSheetCollapsedOffset'
import { useSheetDrag } from '@/hooks/useSheetDrag'
import { useMapView } from '@ev-flow/core/hooks/useMapView'
import { dismissAppInstallForToday, hasDismissedAppInstallToday, isIPhone } from '@/lib/appInstall'
import { IS_GEOLOCATION_ENABLED } from '@/lib/config'
import { MAPO_CENTER } from '@ev-flow/core/lib/constants'
import { LOCATE_FAILURE_MESSAGE } from '@ev-flow/core/lib/geolocation'
import { hasSeenOnboarding, markOnboardingSeen } from '@ev-flow/core/lib/onboarding'
import { countActiveFilters } from '@ev-flow/core/lib/stationFilter'
import type { LatLng } from '@ev-flow/core/types/geo'
import type { Station } from '@ev-flow/core/types/station'

const RECOMMEND_MESSAGE = {
  error: '추천 충전소를 불러오지 못했습니다',
  empty: '추천할 충전소가 없습니다',
  out_of_area: '현재 예측 서비스는 마포구만 지원해요',
}

/** 추천 시트 단계. 위에서부터 펼침(Top 3) · 접힘(첫 카드) · 최소(헤더만) */
type SheetLevel = 'expanded' | 'collapsed' | 'minimized'
const SHEET_LEVELS: SheetLevel[] = ['expanded', 'collapsed', 'minimized']

/** 추천을 불러오는 동안 그리는 자리표시 카드 수 (Top 3) */
const SKELETON_KEYS = ['skeleton-1', 'skeleton-2', 'skeleton-3']

/** 안내 문구를 띄워 두는 시간 */
const NOTICE_DURATION_MS = 3000

export function MapHomePage() {
  const navigate = useNavigate()
  // 예측 시점 · 필터는 검색 화면과 함께 쓰고, 상세에서 뒤로 돌아와도 유지됨
  const { horizon, setHorizon, filters, setFilters, userLocation } = useMapView()
  // 길찾기 화면의 "다른 추천 충전소 보기"로 오면 추천 시트를 펼친 채로 시작
  const location = useLocation()
  const [sheetLevel, setSheetLevel] = useState<SheetLevel>(() =>
    (location.state as { expandSheet?: boolean } | null)?.expandSheet === true
      ? 'expanded'
      : 'collapsed',
  )
  const isSheetExpanded = sheetLevel === 'expanded'
  /** 헤더까지만 남기고 카드를 모두 내린 상태. 지도를 넓게 볼 때 씀 */
  const isSheetMinimized = sheetLevel === 'minimized'

  const { containerRef, map, status } = useNaverMap({ center: MAPO_CENTER, zoom: 14 })
  const {
    stations,
    allStations,
    updatedAt,
    isStationsError,
    recommendations,
    recommendedIds,
    recommendState,
  } = useMapHomeData(horizon, filters)

  // 마커는 시점이 바뀔 때마다 다시 만들지 않도록 최신 시점만 ref로 읽음
  const horizonRef = useRef(horizon)
  useEffect(() => {
    horizonRef.current = horizon
  }, [horizon])
  const openStation = useCallback(
    (stationId: string) => navigate(`/stations/${stationId}?horizon=${horizonRef.current}`),
    [navigate],
  )
  // 추천 카드의 길찾기 버튼은 상세를 거치지 않고 바로 길찾기 화면으로 감
  const openRoute = useCallback(
    (stationId: string) => navigate(`/stations/${stationId}/route?horizon=${horizonRef.current}`),
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
  // 더보기의 "첫 방문 안내 다시 보기"로 왔으면(state.showOnboarding) 본 적이 있어도 띄움
  const isOnboardingReplay =
    (location.state as { showOnboarding?: boolean } | null)?.showOnboarding === true
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(
    () => isOnboardingReplay || !hasSeenOnboarding(),
  )
  /** 안내를 닫으면 본 것으로 기록해서 다음 방문부터는 띄우지 않음 */
  const closeOnboarding = useCallback(() => {
    markOnboardingSeen()
    setIsOnboardingOpen(false)
    // 다시 보기로 열었으면 기록의 값도 지움. 상세에 갔다 뒤로 돌아와도 다시 뜨지 않게 함
    if (isOnboardingReplay) navigate('/', { replace: true })
  }, [isOnboardingReplay, navigate])

  // 아이폰으로 들어오면 첫 안내보다 먼저 앱 설치 안내를 띄움. 오늘 이미 닫았거나 첫 안내 다시 보기로 왔으면 띄우지 않음
  const [isAppInstallOpen, setIsAppInstallOpen] = useState(
    () => !isOnboardingReplay && isIPhone() && !hasDismissedAppInstallToday(),
  )
  /** 앱 안내를 닫으면 오늘은 다시 띄우지 않고, 첫 안내를 아직 안 봤으면 이어서 첫 안내가 뜸 */
  const closeAppInstall = useCallback(() => {
    dismissAppInstallForToday()
    setIsAppInstallOpen(false)
  }, [])
  /** 앱스토어로 가면 앱을 쓸 사람이라 웹 첫 안내는 띄우지 않음. 본 기록은 남기지 않아 다음에 웹으로 오면 뜸 */
  const handleAppInstall = useCallback(() => {
    dismissAppInstallForToday()
    setIsAppInstallOpen(false)
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
  // 위치 권한이 이미 있으면 탭이 열려 있는 동안 위치를 따라감. 추천은 500m · 2분 · 5분 규칙으로만 다시 부름
  const { recheck: recheckTracking } = useLocationTracking(IS_GEOLOCATION_ENABLED)
  const panTo = (target: LatLng) => map?.panTo(new window.naver.maps.LatLng(target.lat, target.lng))
  // 지도만 옮기고 추천은 바로 부르지 않음 (2026-11-22 결정)
  const handleLocate = async () => {
    // 기능이 꺼져 있으면 GPS 없이 지금 기준 위치(시연 위치)로 지도만 옮김
    if (!IS_GEOLOCATION_ENABLED) {
      panTo(userLocation)
      return
    }
    const result = await locate()
    // 이 버튼으로 처음 권한을 허용했으면 그때부터 위치를 따라감 (마포구 밖이어도 허용은 된 것)
    recheckTracking(result.ok || result.reason === 'out-of-area')
    // 찾았으면 그 위치로, 마포구 밖이면 마지막 사용자 위치로 지도를 옮김
    if (result.ok || result.reason === 'out-of-area') {
      panTo(result.ok ? result.location : userLocation)
    }
    // 못 쓴 이유는 잠깐 안내 (권한 거부 · HTTPS 아님 · 마포구 밖 등)
    if (!result.ok) setNotice({ id: Date.now(), message: LOCATE_FAILURE_MESSAGE[result.reason] })
  }

  // 펼침 · 접힘 · 손 뗐을 때만 애니메이션. 데이터가 와서 높이를 처음 잴 때 시트가 미끄러져 내려오지 않게 함
  const [isSheetAnimating, setIsSheetAnimating] = useState(false)
  const changeSheetLevel = (level: SheetLevel) => {
    setIsSheetAnimating(true)
    setSheetLevel(level)
  }
  /** 위로 끌면 한 단계 펼치고 아래로 끌면 한 단계 내림. 맨 끝 단계에서는 그대로 */
  const moveSheetLevel = (step: -1 | 1) => {
    const index = SHEET_LEVELS.indexOf(sheetLevel) + step
    changeSheetLevel(SHEET_LEVELS[Math.min(Math.max(index, 0), SHEET_LEVELS.length - 1)])
  }
  // 지도 빈 곳을 클릭하면 추천 시트를 최소로 내려 지도를 넓게 봄 (앱과 같음). 마커 클릭은 지도 click으로 오지 않음
  useEffect(() => {
    // 지도가 아직 없으면 붙일 곳이 없음
    if (!map) return
    const { maps } = window.naver
    const listener = maps.Event.addListener(map, 'click', () => {
      setIsSheetAnimating(true)
      setSheetLevel('minimized')
    })
    return () => {
      // 인증 실패로 SDK가 비워졌으면 정리 호출도 예외를 던지므로 건너뜀
      if (window.naver.maps) maps.Event.removeListener(listener)
    }
  }, [map])
  const sheetDrag = useSheetDrag({
    onDragUp: () => moveSheetLevel(-1),
    onDragDown: () => moveSheetLevel(1),
    onRelease: () => setIsSheetAnimating(true),
  })
  // 시트는 항상 Top 3를 다 그리고, 접힌 상태에서는 첫 카드만 보이게 아래로 내려 둠
  const sheetRef = useRef<HTMLElement>(null)
  const [firstItem, setFirstItem] = useState<HTMLLIElement | null>(null)
  const collapsedOffset = useSheetCollapsedOffset(sheetRef, firstItem)
  // 최소 단계는 헤더(손잡이 · 제목 · 시점 선택) 아래를 모두 내림
  const [sheetHeader, setSheetHeader] = useState<HTMLDivElement | null>(null)
  const minimizedOffset = useSheetCollapsedOffset(sheetRef, sheetHeader)
  const levelOffset = { expanded: 0, collapsed: collapsedOffset, minimized: minimizedOffset }
  const sheetTranslate = Math.min(
    Math.max(levelOffset[sheetLevel] + sheetDrag.dragOffset, 0),
    minimizedOffset,
  )
  /** 0 = 접힘 이하, 1 = 펼침. 지도 어둡게 하는 정도에 씀 */
  const expandProgress = collapsedOffset ? Math.max(1 - sheetTranslate / collapsedOffset, 0) : 0

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col overflow-hidden bg-bg-map">
      {/* 아래로 내려 둔 시트가 하단 탭 위로 겹치지 않게 잘라냄 */}
      <main className="relative flex-1 overflow-hidden">
        {/* 지도: 네이버 지도가 컨테이너 position을 relative로 덮어써서 바깥 div로 크기 지정 */}
        <div className="absolute inset-0">
          <div ref={containerRef} className="size-full" aria-label="충전소 지도" />
        </div>
        {status !== 'ready' && <MapFallback status={status} />}

        {/* 개발 모드에서만 지금 줌 표시. 배포 빌드에서는 코드째 빠짐. 상태 이상 버튼 아래에 둠 */}
        {import.meta.env.DEV && (
          <div className="absolute top-[124px] right-4">
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
          {/* 왼쪽 갱신 상태, 오른쪽 상태 이상 충전기 버튼 (검색창 오른쪽 아래) */}
          <div className="flex w-full items-start justify-between gap-2">
            <UpdateStatus updatedAt={updatedAt} isError={isStationsError} />
            <ChargerIssuesButton onClick={() => navigate('/charger-issues')} />
          </div>
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
          onClick={() => changeSheetLevel('collapsed')}
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
              // 펼침이면 접고, 접힘이면 펼침. 최소 단계에서는 첫 카드가 보이는 접힘으로 올림
              onClick={sheetDrag.ignoreClickAfterDrag(() =>
                changeSheetLevel(sheetLevel === 'collapsed' ? 'expanded' : 'collapsed'),
              )}
              className="-my-2.5 flex w-full justify-center py-2.5"
            >
              <span className="h-1 w-10 rounded-[2px] bg-border-default" />
            </button>
            <div ref={setSheetHeader} className="flex w-full items-center justify-between">
              {/* 앞의 형광 파란 점은 지도에서 추천 충전소 마커 색과 같음 (범례) */}
              <h2 className="flex items-center gap-1.5 text-[17px] font-bold">
                <span aria-hidden className="size-2.5 rounded-full bg-marker-recommended" />
                추천 충전소
              </h2>
              <HorizonSelector value={horizon} onChange={setHorizon} />
            </div>
          </div>
          {recommendState === 'error' ||
          recommendState === 'empty' ||
          recommendState === 'out_of_area' ||
          recommendState === 'rate_limited' ? (
            <p
              className={`flex w-full flex-col items-center justify-center rounded-lg bg-bg-subtle text-center text-sm text-text-secondary ${RECOMMEND_CARD_HEIGHT_CLASS}`}
            >
              {/* 호출 제한이면 두 줄로, 나머지는 정해진 한 줄 문구 */}
              {recommendState === 'rate_limited' ? (
                <>
                  요청이 많아 추천을 불러오지 못했어요.
                  <br />
                  잠시 후 다시 시도해 주세요.
                </>
              ) : (
                RECOMMEND_MESSAGE[recommendState]
              )}
            </p>
          ) : (
            <ul
              aria-busy={!recommendations}
              className={`flex w-full flex-col gap-3 ${isSheetExpanded ? 'overflow-y-auto' : 'overflow-hidden'}`}
            >
              {recommendations
                ? recommendations.map((recommendation, index) => (
                    <li
                      key={recommendation.station.stationId}
                      ref={index === 0 ? setFirstItem : undefined}
                      // 접혀서 가려진 카드는 키보드 · 스크린리더에서도 숨김 (React 18은 inert 미지원)
                      aria-hidden={isSheetMinimized || (!isSheetExpanded && index > 0)}
                    >
                      <RecommendCard
                        tabIndex={
                          isSheetMinimized || (!isSheetExpanded && index > 0) ? -1 : undefined
                        }
                        recommendation={recommendation}
                        onClick={() => openStation(recommendation.station.stationId)}
                        onRouteClick={() => openRoute(recommendation.station.stationId)}
                      />
                    </li>
                  ))
                : // 불러오는 동안에도 카드 3장 자리를 같은 높이로 잡아 두어 데이터가 와도 시트 크기가 그대로임
                  SKELETON_KEYS.map((key, index) => (
                    <li key={key} ref={index === 0 ? setFirstItem : undefined} aria-hidden>
                      <RecommendCardSkeleton />
                    </li>
                  ))}
              {/* 후보가 3곳 미만이면 짧은 배열로 옴 (UC-U06 E1) */}
              {recommendations && recommendations.length < 3 && (
                <li className="text-center text-[13px] text-text-secondary">
                  조건에 맞는 후보가 {recommendations.length}곳뿐이에요
                </li>
              )}
            </ul>
          )}
        </section>
      </main>
      <BottomTab />
      {/* 앱 안내가 떠 있는 동안에는 첫 안내를 미뤄 두었다가 앱 안내를 닫으면 띄움 */}
      {isAppInstallOpen && (
        <AppInstallSheet onClose={closeAppInstall} onInstall={handleAppInstall} />
      )}
      {isOnboardingOpen && !isAppInstallOpen && <OnboardingDialog onClose={closeOnboarding} />}
    </div>
  )
}
