import { api } from '@ev-flow/core/api/client'
import type {
  AdminChargersResponse,
  AdminPeriod,
  AdminRegion,
  AuthSession,
  CollectionStatusResponse,
  LoginRequest,
  MissingStatsResponse,
  UtilizationResponse,
} from '@/types/admin'

// 로그인 토큰은 서버가 HttpOnly 쿠키로 내려줌 — 같은 출처 요청이라 브라우저가 자동으로 붙여 보냄
export async function login(request: LoginRequest) {
  const { data } = await api.post<AuthSession>('/auth/login', request)
  return data
}

export async function logout() {
  await api.post('/auth/logout')
}

export async function fetchAuthMe() {
  const { data } = await api.get<AuthSession>('/auth/me')
  return data
}

/** district(서울 구 코드)가 undefined면 axios가 쿼리에서 빼서 지역 전체를 받음 */
export async function fetchUtilization(
  region: AdminRegion,
  period: AdminPeriod,
  district?: string,
) {
  const { data } = await api.get<UtilizationResponse>('/admin/utilization', {
    params: { region, period, district },
  })
  return data
}

export async function fetchAdminChargers(region: AdminRegion, district?: string) {
  const { data } = await api.get<AdminChargersResponse>('/admin/chargers', {
    params: { region, district },
  })
  return data
}

export async function fetchCollectionStatus(region: AdminRegion) {
  const { data } = await api.get<CollectionStatusResponse>('/admin/collection-status', {
    params: { region },
  })
  return data
}

export async function fetchMissingStats(region: AdminRegion, period: AdminPeriod) {
  const { data } = await api.get<MissingStatsResponse>('/admin/missing-stats', {
    params: { region, period },
  })
  return data
}
