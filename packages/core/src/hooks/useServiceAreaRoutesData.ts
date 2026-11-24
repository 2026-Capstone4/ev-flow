import { useNationwideServiceAreasQuery } from './useServiceAreasQuery'
import { getListLoadState } from '../lib/loadState'
import { searchServiceAreas, summarizeRoutes } from '../lib/nationwideServiceArea'
import { summarizeRegions } from '../lib/serviceAreaRegion'
import { toDisplayAreas } from '../lib/unmatchedServiceArea'

// 휴게소 탭 화면 데이터. 노선별 · 지역별 목록을 만들고, 검색어가 있으면 검색 결과도 만듦
// 노선 미확인은 같은 휴게소끼리 묶은 화면용 목록(toDisplayAreas)을 기준으로 셈
export function useServiceAreaRoutesData(searchText: string) {
  const query = useNationwideServiceAreasQuery()
  const all = query.data ? toDisplayAreas(query.data.serviceAreas) : undefined
  const routes = all ? summarizeRoutes(all) : undefined
  const regions = all ? summarizeRegions(all) : undefined
  // 검색어가 있을 때만 검색 결과를 만듦. 목록을 아직 못 받았으면 undefined
  const searchResults = all && searchText.trim() ? searchServiceAreas(all, searchText) : undefined

  return {
    routes,
    regions,
    searchResults,
    /** 노선 미확인 휴게소 수 (노선별 목록 맨 아래 줄) */
    unmatchedCount: all?.filter((area) => area.routeName === null).length,
    /** 노선 미확인까지 합친 전국 휴게소 수 (제목 안내용) */
    totalCount: all?.length,
    updatedAt: query.data ? new Date(query.data.updatedAt) : null,
    isError: query.isError,
    loadState: getListLoadState(routes, query.isError),
  }
}
