import { api } from './client'
import type {
  NationwideServiceAreaChargersResponse,
  NationwideServiceAreasResponse,
} from '../types/serviceArea'

/** 전국 고속도로 휴게소 목록 (15번). 노선별 · 지역별 화면이 모두 이 응답 하나로 만듦 */
export async function fetchNationwideServiceAreas() {
  const { data } = await api.get<NationwideServiceAreasResponse>('/service-areas/nationwide')
  return data
}

/** 전국 휴게소 한 곳의 충전기 현황 (16번). id가 한글 휴게소명일 수 있어 Axios params로 넘겨 URL 인코딩을 맡김 */
export async function fetchNationwideServiceAreaChargers(id: string) {
  const { data } = await api.get<NationwideServiceAreaChargersResponse>(
    '/service-areas/nationwide/chargers',
    { params: { id } },
  )
  return data
}
