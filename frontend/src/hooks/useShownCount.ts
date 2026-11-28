import { useState } from 'react'

/** 표를 처음 그릴 때와 더보기를 한 번 누를 때마다 더 그리는 줄 수 */
export const SHOWN_STEP = 100

/**
 * 표에 몇 줄까지 그릴지 — 서울 전체는 충전기가 수천 기라 한 번에 다 그리면 무거워서 더보기로 나눠 그림
 * 목록은 서버에서 한 번에 다 받음 (요약 카드 · 충전소 묶기에 전체가 필요). 줄 그리기만 나눔
 * resetKey가 바뀌면(지역 · 구 · 정렬 · 검색) 처음 줄 수로 돌아감. 폴링으로 목록만 새로 와도 늘린 줄 수는 그대로
 * minCount는 그때 꼭 보여야 하는 줄 수 (충전기를 보고 돌아온 충전소 줄 등)
 */
export function useShownCount(total: number, resetKey: string, minCount = 0) {
  const [state, setState] = useState({ resetKey, count: SHOWN_STEP })
  // 조건이 바뀌었으면 그리는 도중에 바로 처음 줄 수로 되돌림 (effect로 하면 한 번 많이 그린 뒤 줄어듦)
  if (state.resetKey !== resetKey) setState({ resetKey, count: SHOWN_STEP })

  const shown = Math.min(total, Math.max(state.count, minCount))
  return {
    shown,
    remaining: total - shown,
    showMore: () =>
      setState((prev) => ({ ...prev, count: Math.max(prev.count, shown) + SHOWN_STEP })),
  }
}
