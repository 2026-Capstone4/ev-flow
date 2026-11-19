import axios from 'axios'

/**
 * API 호출에 쓰는 axios 인스턴스. 기본은 같은 출처의 /api/v1 (웹 Nginx · Vite 프록시는 /api 전체를 넘김)
 * 다른 주소를 쓸 때는 앱 시작 때 setApiBaseUrl로 바꿈 (웹은 .env, 앱은 절대 URL)
 */
export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10_000,
})

/** API 기본 주소를 바꿈. 첫 요청 전에 한 번 부름 */
export function setApiBaseUrl(baseURL: string) {
  api.defaults.baseURL = baseURL
}
