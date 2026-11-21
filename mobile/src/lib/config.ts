/**
 * 앱 환경 변수. Expo는 EXPO_PUBLIC_로 시작하는 값만 앱 코드에 넣어 줌 (mobile/.env.local)
 * 값이 없으면 운영 서버를 씀. 로컬 백엔드(http)를 부르려면 개발 빌드에 ATS 예외가 필요함 (계획 문서 4번)
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://evflowkr.app/api/v1'

/**
 * 현재 위치(GPS) 사용 여부 (웹 VITE_USE_GEOLOCATION과 같음). 꺼져 있어도 버튼은 보이고, 누르면 시연 위치로 지도만 옮김
 * 시연은 고정 좌표로 하므로 기본은 끔 (.env.local의 EXPO_PUBLIC_USE_GEOLOCATION=true로 켬)
 */
export const IS_GEOLOCATION_ENABLED = process.env.EXPO_PUBLIC_USE_GEOLOCATION === 'true'
