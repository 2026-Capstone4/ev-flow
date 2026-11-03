import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router'
import { queryClient } from '@/app/queryClient'
import { MapHomePage } from '@/pages/MapHomePage'
import { RestAreaListPage } from '@/pages/RestAreaListPage'
import { StationDetailPage } from '@/pages/StationDetailPage'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MapHomePage />} />
          <Route path="/stations/:stationId" element={<StationDetailPage />} />
          <Route path="/rest-areas" element={<RestAreaListPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
