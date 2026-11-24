import { useNationwideServiceAreasQuery } from './useServiceAreasQuery'
import { getListLoadState } from '../lib/loadState'
import { searchServiceAreas, summarizeRoutes } from '../lib/nationwideServiceArea'

// 휴게소 탭 화면 데이터. 전국 휴게소 목록을 노선별로 묶고, 검색어가 있으면 검색 결과도 만듦
export function useServiceAreaRoutesData(searchText: string) {
  const query = useNationwideServiceAreasQuery()
  const all = query.data?.serviceAreas
  const routes = all ? summarizeRoutes(all) : undefined
  // 검색어가 있을 때만 검색 결과를 만듦. 목록을 아직 못 받았으면 undefined
  const searchResults = all && searchText.trim() ? searchServiceAreas(all, searchText) : undefined

  return {
    routes,
    searchResults,
    /** 노선 미확인까지 합친 전국 휴게소 수 (제목 안내용) */
    totalCount: all?.length,
    updatedAt: query.data ? new Date(query.data.updatedAt) : null,
    isError: query.isError,
    loadState: getListLoadState(routes, query.isError),
  }
}
