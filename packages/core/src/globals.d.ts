/**
 * 공용 코드에서 써도 되는 전역. 웹 브라우저와 React Native에 모두 있는 것만 적음
 * tsconfig에 DOM 타입을 넣지 않아서, 여기 없는 브라우저 전역(window · document · localStorage 등)은 타입 오류가 남
 * 새 전역이 필요하면 RN에도 있는지 확인한 뒤 추가
 */

declare function setTimeout(callback: () => void, ms?: number): number
declare function clearTimeout(id: number | undefined): void
declare function setInterval(callback: () => void, ms?: number): number
declare function clearInterval(id: number | undefined): void

/** RN에도 있지만 구현이 웹과 조금 다를 수 있음 (2026-11 기준 앱에서 미확인 — 딥링크 확인 때 같이 봄) */
declare class URLSearchParams {
  constructor(init?: Record<string, string>)
  toString(): string
}
