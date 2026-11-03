import { api } from '@/api/client'
import type {
  Direction,
  ServiceAreaChargersResponse,
  ServiceAreasResponse,
} from '@/types/serviceArea'

export async function fetchServiceAreas() {
  const { data } = await api.get<ServiceAreasResponse>('/service-areas')
  return data
}

// 휴게소명이 한글이라 Axios params로 넘겨 URL 인코딩을 맡김
export async function fetchServiceAreaChargers(name: string, direction: Direction) {
  const { data } = await api.get<ServiceAreaChargersResponse>('/service-areas/chargers', {
    params: { name, direction },
  })
  return data
}
