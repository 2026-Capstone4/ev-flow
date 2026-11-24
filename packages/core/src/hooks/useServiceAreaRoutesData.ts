import { useNationwideServiceAreasQuery } from './useServiceAreasQuery'
import { getListLoadState } from '../lib/loadState'
import { summarizeRoutes } from '../lib/nationwideServiceArea'

// 휴게소 탭(노선별) 화면 데이터. 전국 휴게소 목록을 노선별로 묶음
export function useServiceAreaRoutesData() {
  const query = useNationwideServiceAreasQuery()
  const all = query.data?.serviceAreas
  const routes = all ? summarizeRoutes(all) : undefined

  return {
    routes,
    /** 노선 미확인까지 합친 전국 휴게소 수 (제목 안내용) */
    totalCount: all?.length,
    updatedAt: query.data ? new Date(query.data.updatedAt) : null,
    isError: query.isError,
    loadState: getListLoadState(routes, query.isError),
  }
}
