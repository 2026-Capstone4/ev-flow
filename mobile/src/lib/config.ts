/**
 * 앱 환경 변수. Expo는 EXPO_PUBLIC_로 시작하는 값만 앱 코드에 넣어 줌 (mobile/.env.local)
 * 값이 없으면 운영 서버를 씀. 로컬 백엔드(http)를 부르려면 개발 빌드에 ATS 예외가 필요함 (계획 문서 4번)
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://evflowkr.app/api/v1'

/**
 * partial이면 백엔드에 아직 없는 추천 API만 Mock으로 답하고 나머지는 실제 서버로 보냄 (웹 VITE_USE_MOCK=partial과 같음)
 * 앱은 전체 Mock이 없음. 보정 건수는 운영자 전용이라 웹에만 있음
 */
export const IS_RECOMMENDATIONS_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'partial'
