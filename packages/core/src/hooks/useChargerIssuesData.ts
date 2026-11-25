import { useMemo } from 'react'
import { useStationsQuery } from './useStationsQuery'
import {
  countIssuesByDistrict,
  filterStationsByDistrict,
  groupChargerIssues,
} from '../lib/chargerIssues'

/**
 * 상태 이상 충전기 화면 데이터. 지도 홈과 같은 충전소 목록 쿼리를 함께 써서 따로 요청하지 않음
 * 화면은 '전체'(서울 전체)로 시작하고, 구를 고르면 그 구만 보여 줌
 */
export function useChargerIssuesData(district: string) {
  const stationsQuery = useStationsQuery()
  const data = stationsQuery.data

  // 구 선택 목록 (맨 위 '전체' + 구마다 확인 불가 대수). 폴링 응답이 같으면 data가 그대로라 다시 세지 않음
  const districts = useMemo(() => (data ? countIssuesByDistrict(data.stations) : undefined), [data])

  // 보여 줄 구의 충전소만 묶음. '전체'면 서울 전체
  const issues = useMemo(
    () =>
      data ? groupChargerIssues(filterStationsByDistrict(data.stations, district)) : undefined,
    [data, district],
  )

  return {
    issues,
    districts,
    updatedAt: data ? new Date(data.updatedAt) : null,
    isError: stationsQuery.isError,
    /** 수집이 20분 넘게 끊겨 모든 충전기가 확인 불가로 오는 상태. 목록 대신 안내만 띄움 */
    isAllUnknown: data?.dataQuality === 'baseline',
  }
}
