import axios from 'axios'

export const api = axios.create({
  // 기본은 같은 출처의 /api (Nginx · Vite 프록시). 다른 출처의 백엔드를 쓸 때만 절대 URL 지정
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10_000,
})
