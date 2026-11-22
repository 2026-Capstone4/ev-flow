import { useMemo } from 'react'
import { useStationsQuery } from './useStationsQuery'
import {
  countIssuesByDistrict,
  DEFAULT_DISTRICT,
  findNearestDistrict,
  getDistrict,
  groupChargerIssues,
} from '../lib/chargerIssues'
import { isInSeoul } from '../lib/coverage'
import type { LatLng } from '../types/geo'

/**
 * 상태 이상 충전기 화면 데이터. 지도 홈과 같은 충전소 목록 쿼리를 함께 써서 따로 요청하지 않음
 * 서울 전체는 확인 불가 충전기가 수백 기라 구 하나씩 보여 줌
 * 보여 줄 구: 사용자가 고른 구 → 기기 위치에서 가장 가까운 충전소의 구(서울 안일 때) → 마포구
 */
export function useChargerIssuesData(pickedDistrict: string | null, location: LatLng | null) {
  const stationsQuery = useStationsQuery()
  const data = stationsQuery.data

  // 위치와 충전소 목록이 둘 다 있을 때만 가까운 구를 찾음. 서울 밖이면 찾지 않고 마포구로 둠
  const locatedDistrict = useMemo(
    () =>
      data && location && isInSeoul(location) ? findNearestDistrict(data.stations, location) : null,
    [data, location],
  )
  const district = pickedDistrict ?? locatedDistrict ?? DEFAULT_DISTRICT

  // 구 선택 목록 (구마다 확인 불가 대수). 폴링 응답이 같으면 data가 그대로라 다시 세지 않음
  const districts = useMemo(() => (data ? countIssuesByDistrict(data.stations) : undefined), [data])

  // 보여 줄 구의 충전소만 묶음
  const issues = useMemo(
    () =>
      data
        ? groupChargerIssues(
            data.stations.filter((station) => getDistrict(station.address) === district),
          )
        : undefined,
    [data, district],
  )

  return {
    district,
    /** 사용자가 고르지 않았고 위치로 잡은 구인지. 화면에 '현재 위치'를 붙일 때 씀 */
    isLocatedDistrict: !pickedDistrict && !!locatedDistrict,
    issues,
    districts,
    updatedAt: data ? new Date(data.updatedAt) : null,
    isError: stationsQuery.isError,
    /** 수집이 20분 넘게 끊겨 모든 충전기가 확인 불가로 오는 상태. 목록 대신 안내만 띄움 */
    isAllUnknown: data?.dataQuality === 'baseline',
  }
}
