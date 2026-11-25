import { useState } from 'react'
import { Text, View } from 'react-native'
import { DEFAULT_FILTERS, isDefaultFilters, matchesFilters } from '@ev-flow/core/lib/stationFilter'
import type { RecommendationFilters, Station } from '@ev-flow/core/types/station'
import { Button } from './Button'
import { StationFilterOptions } from './StationFilterOptions'

type FilterPanelProps = {
  /** 지금 지도에 적용된 필터. 패널을 열 때 이 값에서 시작 */
  filters: RecommendationFilters
  /** 필터 전 전체 충전소. 고르는 중인 조건에 맞는 곳 수를 미리 셀 때 씀 */
  allStations: Station[] | undefined
  onApply: (filters: RecommendationFilters) => void
}

/** 웹 그림자(0 4px 16px 16%)를 RN 그림자 속성으로 옮김 */
const SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.16,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
}

/**
 * 지도 홈 검색창 아래로 내려오는 필터 패널. 고르는 동안은 지도에 반영하지 않고 적용을 눌러야 반영(초기화는 바로 반영)
 * 바깥을 누르면 닫히는 건 지도 홈이 패널 뒤에 깐 투명한 판이 맡음
 */
export function FilterPanel({ filters, allStations, onApply }: FilterPanelProps) {
  // 칩마다 마커 · 추천을 다시 불러오지 않게 고르는 값은 패널 안에만 둠
  const [draft, setDraft] = useState(filters)

  // 지도 마커는 실시간 상태라 개수도 지금 기준(0)으로 셈
  // 충전소 목록을 아직 못 받았으면 개수 없이 "적용"만 보여 줌
  const matchCount = allStations?.filter((station) => matchesFilters(station, draft, 0)).length

  return (
    <View
      accessibilityLabel="충전소 필터"
      style={SHADOW}
      className="w-full gap-3 rounded-md bg-bg-page px-4 pt-4 pb-3"
    >
      <StationFilterOptions filters={draft} onChange={setDraft} />
      {/* 지도는 실시간만 보여 주고(추천 충전소는 예외로 항상 형광 파랑으로 표시), 15 · 30분 후 예측으로 거르는 건 검색 화면에서 함 */}
      <Text className="font-sans text-xs text-text-secondary">
        지도는 실시간 기준이고,{'\n'}
        추천 충전소는 파란색 마커로 확인해요.{'\n'}
        15·30분 후 예측으로 찾으려면 검색을 이용해 주세요.
      </Text>
      <View className="mt-1 flex-row gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          // 고르는 값과 지도에 적용된 값이 둘 다 기본이면 되돌릴 게 없어서 막음
          disabled={isDefaultFilters(draft) && isDefaultFilters(filters)}
          // 초기화는 적용을 따로 누르지 않아도 바로 지도에 반영하고 닫음
          onPress={() => onApply(DEFAULT_FILTERS)}
        >
          초기화
        </Button>
        <Button className="flex-[2]" disabled={matchCount === 0} onPress={() => onApply(draft)}>
          {matchCount === undefined
            ? '적용'
            : matchCount === 0
              ? '조건에 맞는 곳이 없어요'
              : `충전소 ${matchCount.toLocaleString()}곳 보기`}
        </Button>
      </View>
    </View>
  )
}
