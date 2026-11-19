import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * 접힌 시트를 아래로 내릴 거리(px). 넘긴 요소(첫 카드 · 헤더)까지만 보이게 나머지를 화면 밖으로 밀어냄.
 * 카드 높이는 내용에 따라 달라서 크기가 바뀔 때마다 다시 잼
 */
export function useSheetCollapsedOffset(
  sheetRef: RefObject<HTMLElement | null>,
  lastVisible: HTMLElement | null,
) {
  const [offset, setOffset] = useState(0)

  // 첫 그림 전에 재서 펼친 시트가 잠깐 보였다가 내려가는 깜빡임을 막음
  useLayoutEffect(() => {
    const sheet = sheetRef.current
    if (!sheet || !lastVisible) {
      setOffset(0)
      return
    }
    const measure = () => {
      const paddingBottom = parseFloat(getComputedStyle(sheet).paddingBottom)
      const visibleHeight = lastVisible.offsetTop + lastVisible.offsetHeight + paddingBottom
      setOffset(Math.max(0, sheet.offsetHeight - visibleHeight))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(sheet)
    observer.observe(lastVisible)
    return () => observer.disconnect()
  }, [sheetRef, lastVisible])

  return offset
}
