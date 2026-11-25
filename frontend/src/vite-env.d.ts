/// <reference types="vite/client" />
/// <reference types="navermaps" />

interface ImportMetaEnv {
  readonly VITE_NAVER_MAP_CLIENT_ID?: string
  /** MSW Mock 사용 - true: 전체 Mock / false: 사용 안 함 */
  readonly VITE_USE_MOCK?: 'true' | 'false'
  readonly VITE_API_BASE_URL?: string
  readonly VITE_PROXY_TARGET?: string
  /** 지도 홈 현재 위치 버튼의 GPS 사용 - false면 버튼은 보이되 시연 위치로 지도만 옮김 */
  readonly VITE_USE_GEOLOCATION?: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
