import { useEffect, useRef, useState, type RefObject } from 'react'
import { Button } from '@/components/Button'
import { StationFilterOptions } from '@/components/StationFilterOptions'
import { DEFAULT_FILTERS, isDefaultFilters, matchesFilters } from '@/lib/stationFilter'
import type { RecommendationFilters, Station } from '@/types/station'

type FilterPanelProps = {
  /** 지금 지도에 적용된 필터. 패널을 열 때 이 값에서 시작 */
  filters: RecommendationFilters
  /** 필터 전 전체 충전소. 고르는 중인 조건에 맞는 곳 수를 미리 셀 때 씀 */
  allStations: Station[] | undefined
  onApply: (filters: RecommendationFilters) => void
  /** 적용하지 않고 닫음 (바깥 누름 · Esc) */
  onClose: () => void
  /** 바깥 누름으로 치지 않을 요소 (필터 버튼). 버튼이 직접 열고 닫음 */
  ignoreRef: RefObject<HTMLElement | null>
}

/** 지도 홈 검색창 아래로 내려오는 필터 패널. 고르는 동안은 지도에 반영하지 않고 적용을 눌러야 반영(초기화는 바로 반영). 지도처럼 실시간 기준 */
export function FilterPanel({
  filters,
  allStations,
  onApply,
  onClose,
  ignoreRef,
}: FilterPanelProps) {
  // 칩마다 마커 · 추천을 다시 불러오지 않게 고르는 값은 패널 안에만 둠
  const [draft, setDraft] = useState(filters)
  const panelRef = useRef<HTMLElement>(null)

  // 패널 · 필터 버튼 밖을 누르거나 Esc를 누르면 고른 값을 버리고 닫음. 지도는 덮지 않아서 그대로 움직일 수 있음
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      // 패널 안이나 필터 버튼을 누른 거면 닫지 않음
      if (panelRef.current?.contains(target) || ignoreRef.current?.contains(target)) return
      onClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      // Esc만 닫기로 처리
      if (event.key === 'Escape') onClose()
    }
    // 네이버 지도가 누름 이벤트를 위로 올려 보내지 않아서, 지도에 닿기 전 단계(capture)에서 받음
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, ignoreRef])

  // 지도 마커는 실시간 상태라 개수도 지금 기준(0)으로 셈
  // 충전소 목록을 아직 못 받았으면 개수 없이 "적용"만 보여 줌
  const matchCount = allStations?.filter((station) => matchesFilters(station, draft, 0)).length

  return (
    <section
      ref={panelRef}
      id="map-filter-panel"
      aria-label="충전소 필터"
      className="flex w-full animate-panel-down flex-col gap-3 rounded-md bg-bg-page px-4 pt-4 pb-3 shadow-[0_4px_16px_rgba(0,0,0,0.16)]"
    >
      <StationFilterOptions filters={draft} onChange={setDraft} />
      {/* 지도는 실시간만 보여 주고(추천 충전소는 예외로 항상 형광 파랑으로 표시), 15 · 30분 후 예측으로 거르는 건 검색 화면에서 함 */}
      <p className="text-xs text-text-secondary">
        지도는 실시간 기준이고, 추천 충전소는 파란색 마커로 확인해요.
        <br />
        15·30분 후 예측으로 찾으려면 검색을 이용해 주세요.
      </p>
      <div className="mt-1 flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          // 고르는 값과 지도에 적용된 값이 둘 다 기본이면 되돌릴 게 없어서 막음
          disabled={isDefaultFilters(draft) && isDefaultFilters(filters)}
          // 초기화는 적용을 따로 누르지 않아도 바로 지도에 반영하고 닫음
          onClick={() => onApply(DEFAULT_FILTERS)}
        >
          초기화
        </Button>
        <Button className="flex-[2]" disabled={matchCount === 0} onClick={() => onApply(draft)}>
          {matchCount === undefined
            ? '적용'
            : matchCount === 0
              ? '조건에 맞는 곳이 없어요'
              : `충전소 ${matchCount.toLocaleString()}곳 보기`}
        </Button>
      </div>
    </section>
  )
}
