/// <reference types="vite/client" />
/// <reference types="navermaps" />

interface ImportMetaEnv {
  readonly VITE_NAVER_MAP_CLIENT_ID?: string
  /** MSW Mock 방식 - true: 전체 Mock / partial: 백엔드에 없는 API만 Mock(지금은 없어서 false와 같음) / false: 사용 안 함 */
  readonly VITE_USE_MOCK?: 'true' | 'false'
  readonly VITE_API_BASE_URL?: string
  readonly VITE_PROXY_TARGET?: string
  /** 지도 홈 현재 위치 버튼의 GPS 사용 - false면 버튼은 보이되 시연 위치로 지도만 옮김 */
  readonly VITE_USE_GEOLOCATION?: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
