import { useServiceAreasQuery } from '@/hooks/useServiceAreasQuery'
import { getListLoadState } from '@/lib/loadState'
import type { Direction } from '@/types/serviceArea'

// 휴게소 목록 화면 데이터. 화면(JSX)과 분리해 RN 전환 시 그대로 재사용
export function useServiceAreaListData(direction: Direction) {
  const query = useServiceAreasQuery()
  const all = query.data?.serviceAreas
  const serviceAreas = all?.filter((area) => area.direction === direction)

  return {
    serviceAreas,
    /** 방향과 상관없이 전체 휴게소 수 (제목 안내용) */
    totalCount: all?.length,
    updatedAt: query.data ? new Date(query.data.updatedAt) : null,
    isError: query.isError,
    loadState: getListLoadState(serviceAreas, query.isError),
  }
}
