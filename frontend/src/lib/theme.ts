import type { CurrentCongestion } from '@/types/station'

/**
 * 색 토큰. 웹 · 앱이 같은 값을 쓰도록 기준을 여기 둠 (Figma Variables와 같은 이름)
 * 웹 Tailwind는 styles/index.css의 @theme(--color-이름)로 같은 값을 씀. 값을 바꾸면 두 곳을 같이 고침 (theme.test.ts가 확인)
 * RN 앱은 NativeWind tailwind.config.js에서 이 객체를 그대로 불러 씀
 */
export const COLORS = {
  'brand-primary': '#2563eb',
  'brand-primary-bg': '#eff6ff',
  'text-primary': '#111827',
  'text-secondary': '#6b7280',
  'text-on-brand': '#ffffff',
  'bg-page': '#ffffff',
  'bg-subtle': '#f3f4f6',
  'bg-map': '#e8ece4',
  'border-default': '#e5e7eb',
  'status-warning': '#b45309',
  'status-warning-bg': '#fffbeb',
  // 충전기 '충전 중' 글자색. 좋음/경고 뜻이 없는 상태라 혼잡도 색과 겹치지 않는 남색
  'status-charging': '#383295',

  'congestion-free': '#16a34a',
  'congestion-free-bg': '#dcfce7',
  'congestion-normal': '#d97706',
  'congestion-normal-bg': '#fef3c7',
  'congestion-busy': '#dc2626',
  'congestion-busy-bg': '#fee2e2',
  'congestion-unknown': '#9ca3af',
  'congestion-unknown-bg': '#f3f4f6',
  // 운영 불가는 확인 불가(데이터 부족)와 구분되게 더 어두운 회색
  'congestion-unavailable': '#4b5563',
  'congestion-unavailable-bg': '#e5e7eb',
  // 지도에서 추천 Top 3 충전소 마커. 혼잡도 색과 겹치지 않는 형광 파랑, 글자는 다른 마커처럼 흰색
  'marker-recommended': '#00a8e8',
  'marker-recommended-text': '#ffffff',
  // 상세 예측 칸의 'AI 예측' 글자. 혼잡도 · 브랜드 파랑 · 충전 중 남색과 겹치지 않는 보라
  ai: '#7c3aed',
} as const

/** 현재 혼잡도별 색. 클래스를 못 쓰는 곳(캔버스 · 지도 SDK 마커 아이콘)에서 씀 */
export const CONGESTION_COLOR: Record<CurrentCongestion, string> = {
  low: COLORS['congestion-free'],
  medium: COLORS['congestion-normal'],
  high: COLORS['congestion-busy'],
  unknown: COLORS['congestion-unknown'],
  unavailable: COLORS['congestion-unavailable'],
}
