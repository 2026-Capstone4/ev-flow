import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import type { RecommendState } from '@ev-flow/core/hooks/useMapHomeData'
import type { HorizonMinutes, Recommendation } from '@ev-flow/core/types/station'
import {
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { type LayoutChangeEvent, Pressable, Text, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { HorizonSelector } from './HorizonSelector'
import { RECOMMEND_CARD_HEIGHT, RecommendCard, RecommendCardSkeleton } from './RecommendCard'

const RECOMMEND_MESSAGE = {
  error: '추천 충전소를 불러오지 못했습니다',
  empty: '추천할 충전소가 없습니다',
  out_of_area: '현재 예측 서비스는 마포구만 지원해요',
  rate_limited: '요청이 많아 추천을 불러오지 못했어요.\n잠시 후 다시 시도해 주세요.',
  // 온보딩을 보는 중 · 처음 위치를 재는 중. 빈 회색 카드 대신 이 칸이 무엇인지 알려 줌
  waiting_location: '현재 위치 주변 추천 충전소가 여기에 표시돼요',
}

/** 추천을 불러오는 동안 그리는 자리표시 카드 수 (Top 3) */
const SKELETON_KEYS = ['skeleton-1', 'skeleton-2', 'skeleton-3']

/** 시트 단계 순서. @gorhom/bottom-sheet의 index와 같음 (작은 높이부터) */
const LEVEL = { minimized: 0, collapsed: 1, expanded: 2 }

/** 손잡이 칸 높이. 위 여백 10 + 손잡이 4 + 아래 여백 12 */
const HANDLE_HEIGHT = 26
/** 헤더(제목 · 시점 선택)의 기본 높이. 시점 선택(32)이 가장 큼. 글자 크기를 키우면 재서 바꿈 */
const DEFAULT_HEADER_HEIGHT = 40
/** 헤더 · 카드 사이와 시트 아래 여백 */
const GAP = 12
/** 펼쳐도 위쪽 검색창 · 갱신 상태가 보이게 남겨 두는 높이 (웹 max-h: 100% - 120px) */
const TOP_RESERVED_HEIGHT = 120

/** 웹 그림자(0 -2px 12px 12%)를 RN 그림자 속성으로 옮김 */
const SHEET_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.12,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: -2 },
}

/** 지도 홈이 시트를 직접 움직일 때 쓰는 함수 */
export type RecommendSheetHandle = {
  /** 펼침(Top 3)으로 올림. 펼침 단계가 없으면(안내 문구뿐) 맨 끝 단계로 */
  expand: () => void
  /** 최소(헤더만)로 내림. 지도를 탭했을 때 씀 */
  minimize: () => void
}

type RecommendSheetProps = {
  ref?: Ref<RecommendSheetHandle>
  recommendations: Recommendation[] | undefined
  recommendState: RecommendState
  horizon: HorizonMinutes
  onHorizonChange: (horizon: HorizonMinutes) => void
  onSelect: (stationId: string) => void
  /** 추천 카드의 길찾기 버튼을 누를 때 */
  onRouteSelect: (station: Recommendation['station']) => void
  /** 시트를 놓을 지도 영역 높이. 펼침 높이 상한을 정할 때 씀 */
  containerHeight: number
  /** 시트 위쪽 끝의 y 좌표(지도 영역 기준)를 받을 값. 현재 위치 버튼을 시트 위에 붙여 함께 움직일 때 씀 */
  animatedPosition?: SharedValue<number>
  /** 지금 단계 번호(끄는 동안은 1.4처럼 중간값)를 받을 값. 펼칠수록 현재 위치 버튼을 흐리게 할 때 씀 */
  animatedIndex?: SharedValue<number>
  /** 펼침 단계에 들어가거나 나올 때 부름 */
  onExpandedChange?: (isExpanded: boolean) => void
}

/**
 * 지도 홈 하단 추천 Top 3 시트. 최소(헤더만) · 접힘(첫 카드) · 펼침(Top 3) 3단계로 끌어서 바꿈
 * 웹은 끌기 · 높이 계산을 직접 했지만 앱은 @gorhom/bottom-sheet의 snapPoints로 맡김
 */
export function RecommendSheet({
  ref,
  recommendations,
  recommendState,
  horizon,
  onHorizonChange,
  onSelect,
  onRouteSelect,
  containerHeight,
  animatedPosition,
  animatedIndex,
  onExpandedChange,
}: RecommendSheetProps) {
  const sheetRef = useRef<BottomSheet>(null)
  // 번호 없이 맨 끝 단계로 가는 expand()를 씀 (아래 toggleLevel과 같은 이유)
  useImperativeHandle(
    ref,
    () => ({
      expand: () => sheetRef.current?.expand(),
      minimize: () => sheetRef.current?.snapToIndex(LEVEL.minimized),
    }),
    [],
  )
  const [level, setLevel] = useState(LEVEL.collapsed)
  // 펼침 높이는 카드 수 · "후보가 n곳뿐" 안내에 따라 달라서 그린 뒤 잰 내용 높이로 정함
  const [contentHeight, setContentHeight] = useState(0)
  // 최소 · 접힘 높이도 헤더 · 첫 칸을 그린 뒤 잰 높이로 정함. iOS 글자 크기를 키우면 칸이 커져서 고정 숫자로 두면 잘림
  const [headerHeight, setHeaderHeight] = useState(DEFAULT_HEADER_HEIGHT)
  const [firstItemHeight, setFirstItemHeight] = useState(RECOMMEND_CARD_HEIGHT)
  /** 최소 단계: 손잡이 + 헤더까지만 */
  const minimizedHeight = HANDLE_HEIGHT + headerHeight + GAP
  /** 접힘 단계: 첫 칸(카드 · 자리표시 · 안내 문구)까지 */
  const collapsedHeight = minimizedHeight + firstItemHeight + GAP

  const isMessage =
    recommendState === 'error' ||
    recommendState === 'empty' ||
    recommendState === 'out_of_area' ||
    recommendState === 'rate_limited' ||
    recommendState === 'waiting_location'
  // 손잡이 + 내용 전체. 아직 못 쟀으면 카드 3장 기준으로 잡아 둠
  const expandedHeight = Math.min(
    HANDLE_HEIGHT + (contentHeight || headerHeight + GAP * 4 + RECOMMEND_CARD_HEIGHT * 3),
    containerHeight - TOP_RESERVED_HEIGHT,
  )
  // 안내 문구 한 칸뿐이면 펼침이 접힘과 같아서 2단계만 둠
  const snapPoints = useMemo(
    () =>
      isMessage || expandedHeight <= collapsedHeight
        ? [minimizedHeight, collapsedHeight]
        : [minimizedHeight, collapsedHeight, expandedHeight],
    [isMessage, minimizedHeight, collapsedHeight, expandedHeight],
  )
  const lastLevel = snapPoints.length - 1
  // 펼친 채로 추천이 오류 · 호출 제한으로 바뀌면 펼침 단계가 없어짐. 화면이 보는 단계는 마지막 단계를 넘지 않게 함
  const currentLevel = Math.min(level, lastLevel)
  const isExpanded = currentLevel === LEVEL.expanded
  // 펼침 여부가 바뀔 때만 알림 (지도 홈이 현재 위치 버튼을 누를 수 없게 함)
  useEffect(() => {
    onExpandedChange?.(isExpanded)
  }, [isExpanded, onExpandedChange])

  // 단계가 줄어 지금 단계가 없어졌으면 시트도 마지막 단계로 옮김. 옮기면 onChange가 level을 맞춤
  useEffect(() => {
    // 지금 단계가 아직 있으면 그대로 둠
    if (level <= lastLevel) return
    sheetRef.current?.snapToIndex(lastLevel)
  }, [level, lastLevel])

  // 펼친 동안만 지도를 어둡게 덮고, 덮개를 누르면 접힘으로 내림
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={LEVEL.expanded}
        disappearsOnIndex={LEVEL.collapsed}
        opacity={0.25}
        pressBehavior={LEVEL.collapsed}
      />
    ),
    [],
  )

  /** 첫 칸 높이를 잼. 접힘 단계 높이에 씀 */
  const measureFirstItem = (event: LayoutChangeEvent) =>
    setFirstItemHeight(event.nativeEvent.layout.height)

  // 손잡이를 누르면 펼침이면 접고, 접힘이면 펼침. 최소 단계에서는 첫 카드가 보이는 접힘으로 올림
  const toggleLevel = () => {
    // 단계 수가 막 바뀐 직후엔 시트 안쪽(UI 스레드)이 아직 옛 단계 수라 snapToIndex(2)가 범위 오류를 냄
    // → 펼치기는 번호 없이 맨 끝 단계로 가는 expand(), 접기는 늘 있는 1번 단계로
    if (currentLevel === LEVEL.collapsed) {
      sheetRef.current?.expand()
      return
    }
    sheetRef.current?.snapToIndex(LEVEL.collapsed)
  }

  return (
    <BottomSheet
      ref={sheetRef}
      index={LEVEL.collapsed}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      onChange={setLevel}
      animatedPosition={animatedPosition}
      animatedIndex={animatedIndex}
      backdropComponent={renderBackdrop}
      // 그림자는 바탕색이 있는 배경에 줘야 iOS가 빠르게 그림 (시트 바깥 칸엔 바탕색이 없음)
      backgroundStyle={{ borderRadius: 20, ...SHEET_SHADOW }}
      // 손잡이를 내용 안에 직접 그림. handleComponent로 넘기면 다시 그릴 때마다 새로 만들어져 누름을 놓침
      handleComponent={null}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isExpanded ? '추천 목록 접기' : '추천 목록 펼치기'}
        accessibilityState={{ expanded: isExpanded }}
        onPress={toggleLevel}
        style={{ height: HANDLE_HEIGHT }}
        className="items-center pt-2.5"
      >
        <View className="h-1 w-10 rounded-[2px] bg-border-default" />
      </Pressable>
      <BottomSheetScrollView
        // 펼쳤을 때만 스크롤 (작은 화면에서 Top 3가 다 안 들어갈 때). 그 밖엔 끌면 시트가 움직임
        scrollEnabled={isExpanded}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: GAP, gap: GAP }}
        onContentSizeChange={(_, height) => setContentHeight(height)}
      >
        <View
          onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
          style={{ minHeight: DEFAULT_HEADER_HEIGHT }}
          // 글자를 키워 한 줄에 안 들어가면 시점 선택을 다음 줄로 내림
          className="flex-row flex-wrap items-center justify-between gap-y-2"
        >
          {/* 앞의 형광 파란 점은 지도에서 추천 충전소 마커 색과 같음 (범례) */}
          <View className="flex-row items-center gap-1.5">
            <View className="size-2.5 rounded-full bg-marker-recommended" />
            <Text accessibilityRole="header" className="font-bold text-[18px] text-text-primary">
              추천 충전소
            </Text>
          </View>
          <HorizonSelector value={horizon} onChange={onHorizonChange} />
        </View>

        {isMessage ? (
          <View
            onLayout={measureFirstItem}
            style={{ minHeight: RECOMMEND_CARD_HEIGHT }}
            className="w-full items-center justify-center rounded-lg bg-bg-subtle px-4 py-3"
          >
            <Text className="text-center font-sans text-sm text-text-secondary">
              {RECOMMEND_MESSAGE[recommendState]}
            </Text>
          </View>
        ) : recommendations ? (
          <>
            {recommendations.map((recommendation, index) => (
              <View
                key={recommendation.station.stationId}
                onLayout={index === 0 ? measureFirstItem : undefined}
              >
                <RecommendCard
                  recommendation={recommendation}
                  onPress={() => onSelect(recommendation.station.stationId)}
                  onRoutePress={() => onRouteSelect(recommendation.station)}
                />
              </View>
            ))}
            {/* 후보가 3곳 미만이면 짧은 배열로 옴 (UC-U06 E1) */}
            {recommendations.length < 3 && (
              <Text className="text-center font-sans text-[14px] text-text-secondary">
                조건에 맞는 후보가 {recommendations.length}곳뿐이에요
              </Text>
            )}
          </>
        ) : (
          // 불러오는 동안에도 카드 3장 자리를 같은 높이로 잡아 두어 데이터가 와도 시트 크기가 그대로임
          SKELETON_KEYS.map((key, index) => (
            <View key={key} onLayout={index === 0 ? measureFirstItem : undefined}>
              <RecommendCardSkeleton />
            </View>
          ))
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  )
}
