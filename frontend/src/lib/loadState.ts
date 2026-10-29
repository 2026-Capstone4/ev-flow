export type ListLoadState = 'loading' | 'error' | 'empty' | 'ready'

/** 목록 데이터 표시 상태. 마지막 정상값이 있으면 갱신 실패여도 그 값을 표시 */
export function getListLoadState(
  items: readonly unknown[] | undefined,
  isError: boolean,
): ListLoadState {
  if (items) return items.length > 0 ? 'ready' : 'empty'
  return isError ? 'error' : 'loading'
}
