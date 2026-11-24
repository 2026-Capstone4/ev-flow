import { useNationwideServiceAreasQuery } from './useServiceAreasQuery'
import { getListLoadState } from '../lib/loadState'
import {
  getRegionLabel,
  getRegionSections,
  getUnmatchedSections,
  summarizeRegions,
} from '../lib/serviceAreaRegion'
import { toDisplayAreas } from '../lib/unmatchedServiceArea'

/** 노선 미확인 화면을 여는 지역 화면 주소 값 (?code=unmatched) */
export const UNMATCHED_REGION_CODE = 'unmatched'

/**
 * 지역 화면 데이터. 목록 화면과 같은 쿼리(전국 휴게소 목록)에서 이 시도만 골라 노선별 소제목으로 묶음
 * code가 'unmatched'면 노선 미확인 휴게소를 시도별 소제목으로 묶음 (노선별 탭의 '노선 미확인' 줄)
 */
export function useServiceAreaRegionData(code: string) {
  const query = useNationwideServiceAreasQuery()
  const all = query.data ? toDisplayAreas(query.data.serviceAreas) : undefined
  const isUnmatched = code === UNMATCHED_REGION_CODE
  const sections = all
    ? isUnmatched
      ? getUnmatchedSections(all)
      : getRegionSections(all, code)
    : undefined
  const areas = sections?.flatMap((section) => section.areas)
  // 제목: 노선 미확인이면 고정 문구, 시도면 서버가 준 전체 이름(경기도), 받기 전에는 짧은 이름
  const region =
    all && !isUnmatched ? summarizeRegions(all).find((r) => r.code === code) : undefined
  const title = isUnmatched ? '노선 미확인 휴게소' : (region?.name ?? getRegionLabel(code))

  return {
    title,
    sections,
    areaCount: areas?.length,
    availableChargers: areas?.reduce((sum, area) => sum + area.availableChargers, 0),
    updatedAt: query.data ? new Date(query.data.updatedAt) : null,
    isError: query.isError,
    loadState: getListLoadState(sections, query.isError),
  }
}
