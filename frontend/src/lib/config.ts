/**
 * 웹 환경 설정. 공용 코드(@ev-flow/core)는 환경 변수를 읽지 않으므로, 공용 코드에 넘길 값은 여기서 읽어 main.tsx에서 넘김
 * 앱은 같은 값을 Expo(process.env.EXPO_PUBLIC_*)에서 읽어 넘김
 * 웹에서만 쓰는 값(지도 SDK Client ID, Mock 방식, 개발 모드)은 그 값을 쓰는 웹 코드에서 직접 읽음
 */

/**
 * API 기본 주소. 기본은 같은 출처의 /api/v1 (Nginx · Vite 프록시는 /api 전체를 넘김)
 * 다른 출처의 백엔드를 쓸 때만 절대 URL 지정 (.env의 VITE_API_BASE_URL). main.tsx에서 setApiBaseUrl로 넘김
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

/** 현재 위치(GPS) 사용 여부. 꺼져 있어도 버튼은 보이고, 누르면 시연 위치로 지도만 옮김. 시연은 고정 좌표로 하므로 기본은 끔 (.env의 VITE_USE_GEOLOCATION) */
export const IS_GEOLOCATION_ENABLED = import.meta.env.VITE_USE_GEOLOCATION === 'true'
