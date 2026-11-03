import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

/** 이보다 짧게 움직이면 드래그가 아니라 탭으로 봄 */
const DRAG_THRESHOLD_PX = 30

type UseSheetDragOptions = {
  onDragUp: () => void
  onDragDown: () => void
  /** 손을 뗄 때마다 호출 (제자리로 돌아가는 경우 포함) */
  onRelease?: () => void
}

/** 바텀 시트 손잡이 영역을 끌어 펼치고 접음. 끄는 동안의 이동량으로 시트가 손가락을 따라옴 */
export function useSheetDrag({ onDragUp, onDragDown, onRelease }: UseSheetDragOptions) {
  /** 누른 지점에서 아래로 움직인 거리(px). 끌고 있지 않으면 null */
  const [dragOffset, setDragOffset] = useState<number | null>(null)
  // 드래그 직후 손잡이 버튼의 click이 이어서 발생해 다시 토글되는 것을 막음
  const didDragRef = useRef(false)

  const onPointerDown = (event: ReactPointerEvent) => {
    const startY = event.clientY
    didDragRef.current = false

    // 손가락이 영역 밖으로 나가도 계속 따라가도록 window에서 들음
    const handleMove = (move: PointerEvent) => setDragOffset(move.clientY - startY)
    const stop = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', stop)
      setDragOffset(null)
      onRelease?.()
    }
    const handleUp = (up: PointerEvent) => {
      stop()
      const deltaY = up.clientY - startY
      if (Math.abs(deltaY) < DRAG_THRESHOLD_PX) return
      didDragRef.current = true
      if (deltaY < 0) onDragUp()
      else onDragDown()
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', stop)
  }

  /** 클릭 핸들러를 감싸 드래그 직후의 클릭은 무시 */
  const ignoreClickAfterDrag = (handler: () => void) => () => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    handler()
  }

  return {
    dragOffset: dragOffset ?? 0,
    isDragging: dragOffset !== null,
    onPointerDown,
    ignoreClickAfterDrag,
  }
}
