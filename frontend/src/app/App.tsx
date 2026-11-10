import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router'
import { MapViewProvider } from '@/app/MapViewProvider'
import { queryClient } from '@/app/queryClient'
import { MapHomePage } from '@/pages/MapHomePage'
import { ServiceAreaDetailPage } from '@/pages/ServiceAreaDetailPage'
import { ServiceAreaListPage } from '@/pages/ServiceAreaListPage'
import { RoutePage } from '@/pages/RoutePage'
import { SearchPage } from '@/pages/SearchPage'
import { StationDetailPage } from '@/pages/StationDetailPage'

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
          </Routes>
        </BrowserRouter>
      </MapViewProvider>
    </QueryClientProvider>
  )
}
