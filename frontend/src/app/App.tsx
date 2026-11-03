import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router'
import { MapViewProvider } from '@/app/MapViewProvider'
import { queryClient } from '@/app/queryClient'
import { MapHomePage } from '@/pages/MapHomePage'
import { RestAreaDetailPage } from '@/pages/RestAreaDetailPage'
import { RestAreaListPage } from '@/pages/RestAreaListPage'
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
            <Route path="/rest-areas" element={<RestAreaListPage />} />
            <Route path="/rest-areas/detail" element={<RestAreaDetailPage />} />
          </Routes>
        </BrowserRouter>
      </MapViewProvider>
    </QueryClientProvider>
  )
}
