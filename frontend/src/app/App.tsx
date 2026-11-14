import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AdminLayout } from '@/app/AdminLayout'
import { MapViewProvider } from '@/app/MapViewProvider'
import { queryClient } from '@/app/queryClient'
import { AdminLoginPage } from '@/pages/AdminLoginPage'
import { MapHomePage } from '@/pages/MapHomePage'
import { ServiceAreaDetailPage } from '@/pages/ServiceAreaDetailPage'
import { ServiceAreaListPage } from '@/pages/ServiceAreaListPage'
import { RoutePage } from '@/pages/RoutePage'
import { SearchPage } from '@/pages/SearchPage'
import { StationDetailPage } from '@/pages/StationDetailPage'

// 대시보드는 차트 라이브러리(Recharts)가 커서 운영자가 들어올 때만 따로 받음 — 사용자 화면 첫 로딩에 포함하지 않음
const AdminDashboardPage = lazy(() =>
  import('@/pages/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })),
)

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MapViewProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MapHomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/stations/:stationId" element={<StationDetailPage />} />
            <Route path="/stations/:stationId/route" element={<RoutePage />} />
            <Route path="/service-areas" element={<ServiceAreaListPage />} />
            <Route path="/service-areas/detail" element={<ServiceAreaDetailPage />} />
            {/* 운영자 화면. /admin 아래는 AdminLayout이 로그인 여부를 먼저 확인함 */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route
                index
                element={
                  // 대시보드 코드를 받는 동안 빈 화면 대신 안내 문구
                  <Suspense
                    fallback={<p className="text-sm text-text-secondary">대시보드 불러오는 중…</p>}
                  >
                    <AdminDashboardPage />
                  </Suspense>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </MapViewProvider>
    </QueryClientProvider>
  )
}
