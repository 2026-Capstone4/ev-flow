import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { BackButton } from '@/components/BackButton'
import { Button } from '@/components/Button'
import { MapFallback } from '@/components/MapFallback'
import { useMyLocationMarker, useStationMarkers } from '@/hooks/useMapMarkers'
import { useMapView } from '@/hooks/useMapView'
import { useNaverMap } from '@/hooks/useNaverMap'
import { useRouteData } from '@/hooks/useRouteData'
import { useRouteOverlay } from '@/hooks/useRouteOverlay'
import { formatWaitRange, NO_PREDICTION_LABEL } from '@/lib/congestion'
import { MAPO_CENTER } from '@/lib/constants'
import { getHorizonWhen, parseHorizon } from '@/lib/horizon'
import {
  detectPlatform,
  getNaverCarRouteUrl,
  NAVER_MAP_APP_STORE_URL,
  type MobilePlatform,
} from '@/lib/naverMapLink'
import { formatDistance } from '@/lib/stationSearch'

/** 경로 시트 높이 대략값. 경로가 시트에 가리지 않게 지도를 맞출 때 씀 */
const ROUTE_SHEET_HEIGHT = 280

// iOS는 앱이 없으면 아무 일도 일어나지 않아, 잠시 뒤에도 화면이 그대로면 App Store로 보냄 (NCP 가이드 방식)
function openNaverMapApp(url: string, platform: MobilePlatform) {
  window.location.href = url
  if (platform !== 'ios') return
  setTimeout(() => {
    if (document.visibilityState === 'visible') window.location.href = NAVER_MAP_APP_STORE_URL
  }, 1500)
}

export function RoutePage() {
  const navigate = useNavigate()
  const { userLocation } = useMapView()
  const { stationId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const horizon = parseHorizon(searchParams.get('horizon'))
  const { containerRef, map, status } = useNaverMap({ center: MAPO_CENTER, zoom: 14 })
  const {
    station,
    route,
    prediction,
    isStationError,
    isRouteError,
    isRouteUnavailable,
    retryRoute,
  } = useRouteData(userLocation, stationId, horizon)

  const stations = useMemo(() => (station ? [station] : undefined), [station])
  useStationMarkers(map, stations)
  useMyLocationMarker(map, userLocation)
  useRouteOverlay(map, route?.path, station ? [userLocation, station] : [], ROUTE_SHEET_HEIGHT)

  const platform = detectPlatform(navigator.userAgent)
  const naverMapUrl = station
    ? getNaverCarRouteUrl(
        {
          destination: { lat: station.lat, lng: station.lng, name: station.name },
          appName: window.location.origin,
        },
        platform,
      )
    : null
  const waitRange = prediction
    ? formatWaitRange(prediction.waitTimeP50Minutes, prediction.waitTimeP90Minutes)
    : null
  // 다른 추천 충전소 보기 (05 → 02): 지도 홈 추천 시트를 펼친 채로 돌아감
  const showOtherRecommendations = () => navigate('/', { state: { expandSheet: true } })

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col overflow-hidden bg-bg-map">
      <main className="relative flex-1">
        <div className="absolute inset-0">
          <div ref={containerRef} className="size-full" aria-label="경로 지도" />
        </div>
        {status !== 'ready' && <MapFallback status={status} />}

        <div className="absolute top-4 left-4">
          <BackButton floating />
        </div>

        <section className="absolute inset-x-0 bottom-0 flex flex-col gap-3.5 rounded-t-[20px] bg-bg-page px-4 pt-5 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-2px_12px_rgba(0,0,0,0.12)]">
          {station ? (
            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-bold">{station.name}</h1>
              <p className="text-[13px] text-text-secondary">{station.address}</p>
            </div>
          ) : isStationError ? (
            <p className="text-sm text-text-secondary">충전소 정보를 불러오지 못했습니다</p>
          ) : (
            // 이름 · 주소 두 줄 자리를 미리 잡아 둠
            <div className="flex animate-pulse flex-col gap-2 py-0.5">
              <div className="h-6 w-1/2 rounded-sm bg-border-default" />
              <div className="h-4 w-2/3 rounded-sm bg-border-default" />
            </div>
          )}

          {isRouteError ? (
            <>
              <p className="flex gap-2 rounded-sm bg-status-warning-bg px-3 py-2.5 text-[13px] text-status-warning">
                <TriangleAlert aria-hidden size={16} strokeWidth={2} className="mt-px shrink-0" />
                {isRouteUnavailable
                  ? '경로를 찾을 수 없어요. 다른 충전소를 선택해 주세요.'
                  : '경로를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'}
              </p>
              {!isRouteUnavailable && (
                <Button variant="secondary" onClick={retryRoute}>
                  다시 시도
                </Button>
              )}
            </>
          ) : (
            // 경로를 받기 전에도 같은 칸 · 버튼 자리를 먼저 보여 줘, 다 받았을 때 시트 높이가 튀지 않게 함
            <>
              <div className="flex gap-2">
                <SummaryTile
                  value={route ? `${route.travelTimeMinutes}분` : null}
                  label="자동차 소요"
                />
                <SummaryTile
                  value={route ? formatDistance(route.distanceMeters) : null}
                  label="거리"
                />
                {/* 지금 출발은 예상 대기 대신 실시간 사용 가능 대수 */}
                {horizon === 0 ? (
                  <SummaryTile
                    value={
                      station ? `${station.availableChargers}/${station.totalChargers}대` : null
                    }
                    label="지금 사용 가능"
                  />
                ) : (
                  <SummaryTile
                    value={station ? (waitRange ?? NO_PREDICTION_LABEL) : null}
                    label={`${getHorizonWhen(horizon)} 예상 대기`}
                  />
                )}
              </div>
              {/* 경로를 찾는 동안은 안내 버튼 자리에 진행 중 표시 */}
              {route ? (
                naverMapUrl ? (
                  <Button onClick={() => openNaverMapApp(naverMapUrl, platform)}>
                    네이버 지도로 안내받기
                  </Button>
                ) : (
                  <p className="rounded-sm bg-bg-subtle px-3 py-2.5 text-center text-[13px] text-text-secondary">
                    휴대폰에서 열면 네이버 지도 앱으로 안내받을 수 있어요
                  </p>
                )
              ) : (
                <Button disabled aria-busy className="gap-2">
                  <LoaderCircle aria-hidden size={18} className="animate-spin" />
                  경로를 찾고 있어요
                </Button>
              )}
            </>
          )}

          <Button
            variant={isRouteError ? 'primary' : 'secondary'}
            onClick={showOtherRecommendations}
          >
            다른 추천 충전소 보기
          </Button>
        </section>
      </main>
    </div>
  )
}

// value가 null이면 아직 받는 중이라 값 자리에 깜빡이는 막대를 보여 줌
function SummaryTile({ value, label }: { value: string | null; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md bg-bg-subtle py-3">
      {value === null ? (
        <span className="my-1 h-5 w-12 animate-pulse rounded-sm bg-border-default" />
      ) : (
        <span className="text-lg font-bold">{value}</span>
      )}
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  )
}
