import axios from 'axios'

export const api = axios.create({
  // 기본은 같은 출처의 /api/v1 (Nginx · Vite 프록시는 /api 전체를 넘김). 다른 출처의 백엔드를 쓸 때만 절대 URL 지정
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 10_000,
})
