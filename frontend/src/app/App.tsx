import { QueryClientProvider } from '@tanstack/react-query'
import { lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AdminLayout } from '@/app/AdminLayout'
import { MapViewProvider } from '@ev-flow/core/app/MapViewProvider'
import { queryClient } from '@/app/queryClient'
import { AdminLoginPage } from '@/pages/AdminLoginPage'
import { ChargerIssuesPage } from '@/pages/ChargerIssuesPage'
import { PRIVACY_PATH, SUPPORT_PATH } from '@/lib/serviceInfo'
import { MapHomePage } from '@/pages/MapHomePage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { ServiceAreaDetailPage } from '@/pages/ServiceAreaDetailPage'
import { ServiceAreaListPage } from '@/pages/ServiceAreaListPage'
import { RoutePage } from '@/pages/RoutePage'
import { SearchPage } from '@/pages/SearchPage'
import { StationDetailPage } from '@/pages/StationDetailPage'
import { SupportPage } from '@/pages/SupportPage'

// 운영자 화면은 차트 라이브러리(Recharts)가 커서 운영자가 들어올 때만 따로 받음 — 사용자 화면 첫 로딩에 포함하지 않음
const AdminStatusPage = lazy(() =>
  import('@/pages/AdminStatusPage').then((module) => ({ default: module.AdminStatusPage })),
)
const AdminChargerIssuesPage = lazy(() =>
  import('@/pages/AdminChargerIssuesPage').then((module) => ({
    default: module.AdminChargerIssuesPage,
  })),
)
const AdminCollectionPage = lazy(() =>
  import('@/pages/AdminCollectionPage').then((module) => ({ default: module.AdminCollectionPage })),
)

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MapViewProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MapHomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/charger-issues" element={<ChargerIssuesPage />} />
            <Route path="/stations/:stationId" element={<StationDetailPage />} />
            <Route path="/stations/:stationId/route" element={<RoutePage />} />
            <Route path="/service-areas" element={<ServiceAreaListPage />} />
            <Route path="/service-areas/detail" element={<ServiceAreaDetailPage />} />
            {/* App Store 지원 · 개인정보 처리방침 URL. 앱 더보기 탭이 이 주소를 외부 브라우저로 엶 */}
            <Route path={SUPPORT_PATH} element={<SupportPage />} />
            <Route path={PRIVACY_PATH} element={<PrivacyPage />} />
            {/* 운영자 화면. /admin 아래는 AdminLayout이 로그인 여부를 먼저 확인함 */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminStatusPage />} />
              <Route path="charger-issues" element={<AdminChargerIssuesPage />} />
              <Route path="collection" element={<AdminCollectionPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </MapViewProvider>
    </QueryClientProvider>
  )
}
