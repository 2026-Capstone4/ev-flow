import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AdminLayout } from '@/app/AdminLayout'
import { MapViewProvider } from '@ev-flow/core/app/MapViewProvider'
import { AppInstallQrCard } from '@/components/AppInstallQrCard'
import { queryClient } from '@/app/queryClient'
import { AdminLoginPage } from '@/pages/AdminLoginPage'
import { ChargerIssuesPage } from '@/pages/ChargerIssuesPage'
import { PRIVACY_PATH, SUPPORT_PATH } from '@/lib/serviceInfo'
import { MapHomePage } from '@/pages/MapHomePage'
import { MorePage } from '@/pages/MorePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { DataSourcesPage } from '@/pages/more/DataSourcesPage'
import { ServiceAreaInfoPage } from '@/pages/more/ServiceAreaInfoPage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { ServiceAreaDetailPage } from '@/pages/ServiceAreaDetailPage'
import { ServiceAreaListPage } from '@/pages/ServiceAreaListPage'
import { ServiceAreaRegionPage } from '@/pages/ServiceAreaRegionPage'
import { ServiceAreaRoutePage } from '@/pages/ServiceAreaRoutePage'
import { RoutePage } from '@/pages/RoutePage'
import { SearchPage } from '@/pages/SearchPage'
import { StationDetailPage } from '@/pages/StationDetailPage'
import { SupportPage } from '@/pages/SupportPage'
import {
  loadAdminChargerIssuesPage,
  loadAdminCollectionPage,
  loadAdminStatusPage,
} from '@/app/adminPages'

// 운영자 화면은 차트 라이브러리(Recharts)가 커서 운영자가 들어올 때만 따로 받음 — 사용자 화면 첫 로딩에 포함하지 않음
// 오픈소스 라이선스 목록(수백 줄 JSON)도 그 화면에 들어올 때만 받음
const LicensesPage = lazy(() =>
  import('@/pages/more/LicensesPage').then((module) => ({ default: module.LicensesPage })),
)
const AdminStatusPage = lazy(() =>
  loadAdminStatusPage().then((module) => ({ default: module.AdminStatusPage })),
)
const AdminChargerIssuesPage = lazy(() =>
  loadAdminChargerIssuesPage().then((module) => ({ default: module.AdminChargerIssuesPage })),
)
const AdminCollectionPage = lazy(() =>
  loadAdminCollectionPage().then((module) => ({ default: module.AdminCollectionPage })),
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
            <Route path="/service-areas/route" element={<ServiceAreaRoutePage />} />
            <Route path="/service-areas/region" element={<ServiceAreaRegionPage />} />
            <Route path="/service-areas/detail" element={<ServiceAreaDetailPage />} />
            <Route path="/more" element={<MorePage />} />
            <Route path="/more/service-area" element={<ServiceAreaInfoPage />} />
            <Route path="/more/data-sources" element={<DataSourcesPage />} />
            <Route
              path="/more/licenses"
              element={
                <Suspense fallback={null}>
                  <LicensesPage />
                </Suspense>
              }
            />
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
            {/* 위 경로에 하나도 맞지 않는 주소 (React Router가 순서와 상관없이 가장 나중에 고름) */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          {/* 앱 설치 QR은 화면을 옮겨도 사라지지 않도록 Routes 밖에 한 번만 둠 */}
          <AppInstallQrCard />
        </BrowserRouter>
      </MapViewProvider>
    </QueryClientProvider>
  )
}
