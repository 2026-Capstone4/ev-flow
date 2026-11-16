/// <reference types="vite/client" />
/// <reference types="navermaps" />

interface ImportMetaEnv {
  readonly VITE_NAVER_MAP_CLIENT_ID?: string
  /** MSW Mock 방식 - true: 전체 Mock / partial: 추천 · 길찾기 · 대시보드 보정 건수만 Mock(로그인 · 대시보드는 실제 서버) / false: 사용 안 함 */
  readonly VITE_USE_MOCK?: 'true' | 'partial' | 'false'
  readonly VITE_API_BASE_URL?: string
  readonly VITE_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
