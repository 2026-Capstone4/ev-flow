/// <reference types="vite/client" />
/// <reference types="navermaps" />

interface ImportMetaEnv {
  readonly VITE_NAVER_MAP_CLIENT_ID?: string
  readonly VITE_USE_MOCK?: string
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
