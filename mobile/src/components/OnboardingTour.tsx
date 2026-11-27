import { type ComponentType, Fragment, type ReactNode, useEffect, useState } from 'react'
import { Modal, Pressable, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { scheduleOnRN } from 'react-native-worklets'
import { COLORS } from '@ev-flow/core/lib/theme'
import type { Recommendation } from '@ev-flow/core/types/station'
import type { TourRect } from '../lib/tourTargets'
import { createShadow } from '../lib/shadow'
import { Button } from './Button'
import { KoreanText } from './KoreanText'
import { Text } from './Text'

export type TourStep = {
  /** 아이콘 컴포넌트. lucide 아이콘이나 같은 모양(size · color)을 받는 앱 로고 */
  icon: ComponentType<{ size?: number; color?: string }>
  title: string
  body: string
  /** 지도 숫자 마커를 흉내 낸 예시 한 줄. 마커 모양 옆에 뜻을 적음 */
  markerExample?: { text: string; className: string; caption: string }
  /** body 아래에 아이콘과 함께 한 줄씩 보여 주는 핵심 기능 */
  points?: {
    icon: ComponentType<{ size?: number; color?: string }>
    text: string
    /** 글 아래 작은 회색 덧붙임. 기능이 지원되는 범위 같은 단서를 적음 */
    note?: string
  }[]
  /** 색 범례. 지도 마커 색과 같음 */
  legend?: { label: string; className: string }[]
  /** 서비스 이름을 크게 보여 주는 첫 장. 아이콘 · 제목을 키우고 제목을 브랜드 색으로 씀 */
  isIntro?: boolean
  /** 화면에서 밝게 뚫어 짚을 칸을 잼. 없거나 null이면 가운데 카드만 보여 줌 */
  measure?: () => Promise<TourRect | null>
  /** 뚫은 칸의 모서리 둥글기. 짚는 요소의 모서리와 같게 둠 */
  holeRadius?: number
  /** 아래쪽 모서리 둥글기가 위쪽과 다를 때만 씀 (추천 시트는 아래가 하단 탭에 붙어 각짐) */
  holeBottomRadius?: number
}

/**
 * 안내를 보는 동안 추천 시트에 대신 보여 주는 예시 추천 1곳
 * 처음 들어온 사용자는 위치를 재기 전이라 추천이 비어 있어서, 카드가 어떻게 생겼는지 이걸로 보여 줌. 지도 마커는 그리지 않음
 */
export const ONBOARDING_SAMPLE_RECOMMENDATION: Recommendation = {
  rank: 1,
  station: {
    stationId: 'onboarding-sample',
    name: 'EV Flow 충전소',
    lat: 0,
    lng: 0,
    totalChargers: 4,
    availableChargers: 3,
  },
  congestion: 'low',
  waitTimeP50Minutes: 0,
  waitTimeP90Minutes: 3,
  source: 'model',
  travelTimeMinutes: 6,
  distanceMeters: 1800,
  travelTimeSource: 'directions',
  reason: '2분 더 걸리지만 덜 붐벼요',
}

/** 뚫은 칸과 설명 카드 사이 간격 */
const CARD_GAP = 16

/** 카드를 화면 위아래 안전 영역에서 이만큼 더 떨어뜨림 */
const CARD_EDGE = 8

/** 안내 카드가 사라지는 시간. 이전 카드가 다 사라진 뒤 다음 카드가 나타남 */
const CARD_FADE_OUT_MS = 100

/** 다음 카드가 나타나는 시간 */
const CARD_FADE_IN_MS = 100

/** 칸이 다음 자리로 옮겨 가는 시간 */
const HOLE_MOVE_MS = 250

/** 짚은 칸 테두리가 한 번 퍼지며 사라지는 시간. 끝나면 칸 둘레에서 다시 시작함 */
const RING_PULSE_MS = 1200

/** 테두리가 한 번 깜빡이는 동안 칸에서 바깥으로 퍼지는 거리 */
const RING_SPREAD = 8

/** 테두리 두께. 칸 바깥쪽에 붙여 그려 짚은 요소를 가리지 않음 */
const RING_WIDTH = 2

/** 어둡게 덮는 정도. 짚은 칸이 잘 보이게 예전 안내 창(40%)보다 조금 진하게 둠 */
const DIM_OPACITY = 0.55

/**
 * 안내 카드 바탕색. 흰 지도 화면 위에서 안내 카드인 게 드러나게 아주 연한 파스텔 파랑을 씀
 * brand-primary-bg(#eff6ff)보다 옅어서, 카드 안의 아이콘 원 · 이전 버튼은 흰색으로 바꿔 구분함
 */
export const CARD_BG = '#f5f8ff'

/** 웹 그림자(0 8px 24px 18%)를 RN 그림자 속성으로 옮김 */
export const CARD_SHADOW = createShadow(8, 24, 0.18)

const AnimatedPath = Animated.createAnimatedComponent(Path)

/**
 * 둥근 사각형 SVG 경로. 화면 전체 사각형과 함께 evenodd로 칠하면 이 칸만 뚫림
 * 위 · 아래 모서리 둥글기를 따로 받아 아래만 각진 추천 시트도 그대로 뚫음
 */
function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  topRadius: number,
  bottomRadius: number,
) {
  'worklet'
  const t = Math.max(0, Math.min(topRadius, w / 2, h / 2))
  const b = Math.max(0, Math.min(bottomRadius, w / 2, h / 2))
  return (
    `M${x + t} ${y}H${x + w - t}A${t} ${t} 0 0 1 ${x + w} ${y + t}` +
    `V${y + h - b}A${b} ${b} 0 0 1 ${x + w - b} ${y + h}` +
    `H${x + b}A${b} ${b} 0 0 1 ${x} ${y + h - b}` +
    `V${y + t}A${t} ${t} 0 0 1 ${x + t} ${y}Z`
  )
}

/**
 * 칸이 있는 장의 카드 위쪽 끝 y. 칸이 화면 위쪽이면 아래에, 아래쪽이면 위에 먼저 붙여 봄
 * 그쪽에 자리가 모자라면 반대쪽에, 양쪽 다 모자라면 화면 안에 들어오게 밀어 넣음 (칸을 조금 가릴 수 있음)
 */
function getCardTop(
  target: TourRect,
  cardHeight: number,
  screenHeight: number,
  insets: { top: number; bottom: number },
) {
  const minTop = insets.top + CARD_EDGE
  const maxTop = screenHeight - insets.bottom - CARD_EDGE - cardHeight
  const below = target.y + target.height + CARD_GAP
  const above = target.y - CARD_GAP - cardHeight
  const isBelowFirst = target.y + target.height / 2 < screenHeight / 2
  const first = isBelowFirst ? below : above
  const second = isBelowFirst ? above : below
  const fits = (top: number) => top >= minTop && top <= maxTop
  // 먼저 붙여 볼 쪽에 들어가면 그대로
  if (fits(first)) return first
  // 반대쪽에 들어가면 반대쪽
  if (fits(second)) return second
  return Math.min(Math.max(first, minTop), maxTop)
}

type OnboardingTourProps = {
  steps: TourStep[]
  /** 건너뛰기 · 시작하기로 안내를 닫을 때 부름 */
  onClose: () => void
}

/**
 * 처음 들어온 사용자에게 실제 화면을 한 곳씩 짚으며 사용법을 보여 주는 안내
 * 화면 전체를 어둡게 덮고 짚을 칸만 뚫은 뒤, 그 위나 아래에 설명 카드를 띄움. 뚫린 칸을 눌러도 다음으로 넘어감
 */
export function OnboardingTour({ steps, onClose }: OnboardingTourProps) {
  const insets = useSafeAreaInsets()
  const [stepIndex, setStepIndex] = useState(0)
  // 지금 장 카드의 높이. 칸 위 · 아래 중 카드가 들어갈 쪽을 고를 때 씀. 숨겨 그린 카드로 잼
  const [cardHeight, setCardHeight] = useState<{ index: number; height: number } | null>(null)
  // 지금 장의 칸을 다 잰 결과. 재는 동안은 이전 장 카드가 그대로 보임
  const [measured, setMeasured] = useState<{ index: number; hole: TourRect | null } | null>(null)
  // 안내 창 크기. Android는 하단 바 칸까지 덮어서 화면 크기 값과 다를 수 있어 직접 잼
  const [size, setSize] = useState({ width: 0, height: 0 })
  const isLastStep = stepIndex === steps.length - 1

  // 뚫은 칸 위치 · 크기 · 둥글기. 장을 넘기면 다음 칸으로 미끄러지듯 옮겨 감
  const holeX = useSharedValue(0)
  const holeY = useSharedValue(0)
  const holeWidth = useSharedValue(0)
  const holeHeight = useSharedValue(0)
  const holeRadius = useSharedValue(0)
  const holeBottomRadius = useSharedValue(0)
  const screenWidth = useSharedValue(0)
  const screenHeight = useSharedValue(0)

  // 장이 바뀌면 그 장이 짚을 칸을 재고, 칸을 그 자리로 옮김
  useEffect(() => {
    // 안내 창 크기를 재기 전에는 칸을 어디로 옮길지 정할 수 없음
    if (size.width === 0) return
    let isCancelled = false
    const current = steps[stepIndex]
    const measure = current.measure ?? (() => Promise.resolve(null))
    // 재다가 실패하면(지도 좌표 변환 오류 등) 칸 없이 가운데 카드로 보여 줌. 그냥 두면 카드가 다시 나타나지 않아 안내를 닫을 수 없음
    const measureSafely = () => measure().catch(() => null)
    measureSafely().then((rect) => {
      // 재는 동안 장을 또 넘겼으면 늦게 온 결과는 버림
      if (isCancelled) return
      // 짚는 요소 칸과 똑같이 뚫음 (여백 없음)
      const hole = rect
      const radius = current.holeRadius ?? 12
      const next = hole
        ? { ...hole, radius, bottomRadius: current.holeBottomRadius ?? radius }
        : { x: 0, y: 0, width: 0, height: 0, radius: 0, bottomRadius: 0 }
      // 칸에서 칸으로 넘어갈 때만 미끄러지듯 옮김. 칸이 생기거나 없어질 때는 바로 바꿔 화면 가운데서 커지고 줄어드는 움직임을 없앰
      const isMove = hole !== null && holeWidth.get() > 0
      const move = (value: number) =>
        isMove
          ? withTiming(value, { duration: HOLE_MOVE_MS, easing: Easing.out(Easing.cubic) })
          : value
      holeX.set(move(next.x))
      holeY.set(move(next.y))
      holeWidth.set(move(next.width))
      holeHeight.set(move(next.height))
      holeRadius.set(move(next.radius))
      holeBottomRadius.set(move(next.bottomRadius))
      setMeasured({ index: stepIndex, hole })
    })
    return () => {
      isCancelled = true
    }
  }, [stepIndex, steps, size, holeX, holeY, holeWidth, holeHeight, holeRadius, holeBottomRadius])

  // 화면 전체 사각형에서 뚫을 칸을 빼고 칠함
  const dimProps = useAnimatedProps(() => ({
    d:
      `M0 0H${screenWidth.value}V${screenHeight.value}H0Z` +
      roundedRectPath(
        holeX.value,
        holeY.value,
        holeWidth.value,
        holeHeight.value,
        holeRadius.value,
        holeBottomRadius.value,
      ),
  }))

  // 짚은 칸 둘레의 흰 테두리가 바깥으로 퍼지며 사라지기를 되풀이해 눌러 볼 곳임을 알려 줌
  const pulse = useSharedValue(0)
  useEffect(() => {
    // 0 → 1로 퍼진 뒤 바로 0으로 돌아가 다시 시작 (-1 = 끝없이)
    pulse.set(
      withRepeat(
        withSequence(withTiming(1, { duration: RING_PULSE_MS }), withTiming(0, { duration: 0 })),
        -1,
      ),
    )
  }, [pulse])
  const ringStyle = useAnimatedStyle(() => {
    // 칸 바로 바깥에서 시작해 RING_SPREAD만큼 퍼짐. 시작할 때는 짚은 요소 테두리에 딱 붙음
    const spread = RING_WIDTH + pulse.value * RING_SPREAD
    return {
      left: holeX.value - spread,
      top: holeY.value - spread,
      width: holeWidth.value + spread * 2,
      height: holeHeight.value + spread * 2,
      borderTopLeftRadius: holeRadius.value + spread,
      borderTopRightRadius: holeRadius.value + spread,
      borderBottomLeftRadius: holeBottomRadius.value + spread,
      borderBottomRightRadius: holeBottomRadius.value + spread,
      // 칸이 없는 장(가운데 카드)에서는 숨김. 퍼질수록 흐려짐
      opacity: holeWidth.value > 0 ? 1 - pulse.value : 0,
    }
  })

  /** 마지막 장이면 안내를 닫고, 아니면 다음 장으로 넘김 */
  const handleNext = () => {
    // 카드가 바뀌는 중에는 무시함. 사라지는 이전 카드를 또 누르면 한 장을 건너뛰거나 마지막 장을 못 보고 닫힘
    if (isChanging) return
    // 마지막 장의 시작하기는 건너뛰기와 같이 안내를 닫음
    if (isLastStep) {
      onClose()
      return
    }
    goTo(stepIndex + 1)
  }
  /** 이전 장으로 돌아감. 첫 장이거나 카드가 바뀌는 중이면 무시함 (빠르게 두 번 누르면 없는 장으로 가서 앱이 멈춤) */
  const handlePrev = () => {
    // 바뀌는 중이거나 더 갈 곳이 없으면 아무것도 안 함
    if (isChanging || stepIndex === 0) return
    goTo(stepIndex - 1)
  }

  // 보이는 카드의 투명도. 장을 넘기면 0으로 내렸다가, 다음 카드로 바꾼 뒤 1로 올림
  const cardOpacity = useSharedValue(1)
  const cardStyle = useAnimatedStyle(() => ({ opacity: cardOpacity.value }))
  // 이전 카드가 다 사라진 장 번호. 이 장이 될 때까지 다음 카드로 바꾸지 않음
  const [fadedOutFor, setFadedOutFor] = useState<number | null>(null)
  /** 지금 카드를 흐리게 지우기 시작하고, 다 지워지면 다음 장 카드로 바꿀 수 있다고 적어 둠 */
  const goTo = (next: number) => {
    setStepIndex(next)
    cardOpacity.set(
      withTiming(0, { duration: CARD_FADE_OUT_MS }, (finished) => {
        // 중간에 멈췄으면(안내를 닫는 등) 적지 않음
        if (finished) scheduleOnRN(setFadedOutFor, next)
      }),
    )
  }

  // 지금 장의 칸 · 카드 높이. 아직 못 쟀으면 undefined · null
  const currentHole = measured?.index === stepIndex ? measured.hole : undefined
  const currentHeight = cardHeight?.index === stepIndex ? cardHeight.height : null

  // 화면에 보이는 카드. 다음 장 카드의 칸 · 높이를 다 잴 때까지 이전 장 카드를 그대로 두어, 넘길 때 카드가 비는 순간이 없게 함
  const [placed, setPlaced] = useState<{
    index: number
    hole: TourRect | null
    top: number | null
  } | null>(null)
  // 보이는 카드가 아직 지금 장이 아닌 동안(사라지는 중 · 다음 칸을 재는 중)은 넘기기 입력을 받지 않음
  const isChanging = placed !== null && placed.index !== stepIndex
  // 지금 장의 칸 · 높이를 다 쟀으면 보이는 카드를 지금 장으로 바꿈 (칸이 없는 장은 높이 없이 가운데에 놓음)
  // 이펙트를 거치지 않고 그리는 중에 바꿔서, 다 잰 바로 그 화면에서 카드가 바뀜 (React의 이전 값 비교 방식)
  const isCurrentReady =
    currentHole !== undefined && (currentHole === null || currentHeight !== null)
  // 첫 장은 바로 보여 주고, 둘째 장부터는 이전 카드가 다 사라진 뒤에 바꿈
  const isPreviousGone = placed === null || placed.index === stepIndex || fadedOutFor === stepIndex
  if (
    isCurrentReady &&
    isPreviousGone &&
    (placed?.index !== stepIndex || placed.hole !== currentHole)
  ) {
    setPlaced({
      index: stepIndex,
      hole: currentHole,
      top:
        currentHole && currentHeight !== null
          ? getCardTop(currentHole, currentHeight, size.height, insets)
          : null,
    })
  }

  // 보이는 카드가 다음 장으로 바뀌면 서서히 나타나게 함
  const placedIndex = placed?.index
  useEffect(() => {
    // 아직 카드가 없으면 할 일이 없음
    if (placedIndex === undefined) return
    cardOpacity.set(withTiming(1, { duration: CARD_FADE_IN_MS }))
  }, [placedIndex, cardOpacity])

  /** 한 장의 카드. 숨겨서 높이를 잴 때와 화면에 보일 때 같은 모양으로 그림 */
  const renderCard = (index: number, hasHole: boolean, onLayout?: (height: number) => void) => {
    const isLast = index === steps.length - 1
    return (
      <View
        onLayout={onLayout && ((event) => onLayout(event.nativeEvent.layout.height))}
        accessibilityViewIsModal
        style={[CARD_SHADOW, { backgroundColor: CARD_BG }]}
        className="w-full max-w-[360px] gap-4 rounded-lg p-5"
      >
        <View className="min-h-[20px] flex-row items-center justify-between">
          <Text className="font-medium text-[14px] text-text-secondary">
            {index + 1} / {steps.length}
          </Text>
          {/* 마지막 장에서는 시작하기 버튼과 같은 일이라 건너뛰기를 숨김 */}
          {!isLast && (
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Text className="font-medium text-[14px] text-text-secondary">건너뛰기</Text>
            </Pressable>
          )}
        </View>

        <StepContent step={steps[index]} hasHole={hasHole} />

        {/* 지금 몇 번째 장인지 점으로 표시. 지금 장만 길고 진한 색 */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="flex-row justify-center gap-1.5"
        >
          {steps.map((item, dotIndex) => (
            <View
              key={item.title}
              className={`h-1.5 rounded-full ${
                dotIndex === index ? 'w-4 bg-brand-primary' : 'w-1.5 bg-border-default'
              }`}
            />
          ))}
        </View>

        {/* 버튼을 flex: 1 칸으로 감싸 두 버튼이 글자 길이와 상관없이 절반씩 같은 폭이 되게 함 */}
        <View className="flex-row gap-2">
          {/* 첫 장에서는 돌아갈 곳이 없어 이전 버튼을 숨김 */}
          {index > 0 && (
            <View style={{ flex: 1 }}>
              <Button variant="surface" onPress={handlePrev}>
                이전
              </Button>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Button onPress={handleNext}>{isLast ? '시작하기' : '다음'}</Button>
          </View>
        </View>
      </View>
    )
  }

  return (
    // 바깥을 눌러도 닫히지 않음 (예전 안내 창과 같음). Android 뒤로 가기(onRequestClose)도 아무 일 안 함
    // 닫으면 위치 권한까지 바로 묻게 되어서, 건너뛰기 · 시작하기로만 닫음
    // statusBarTranslucent · navigationBarTranslucent로 상태 표시줄 · 하단 바 칸까지 창을 넓혀 지도 홈과 좌표를 맞춤
    <Modal
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => {}}
    >
      <View
        className="flex-1"
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout
          screenWidth.set(width)
          screenHeight.set(height)
          setSize({ width, height })
        }}
      >
        <Svg width={size.width} height={size.height} style={{ position: 'absolute' }}>
          <AnimatedPath
            animatedProps={dimProps}
            fill="black"
            fillOpacity={DIM_OPACITY}
            fillRule="evenodd"
          />
        </Svg>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              borderWidth: RING_WIDTH,
              borderColor: COLORS['text-on-brand'],
            },
            ringStyle,
          ]}
        />
        {/* 뚫린 칸을 누르면 다음 장으로. 아래 실제 버튼 · 탭은 누르지 않음 (지금 눌리면 위치 권한 · 화면 이동이 섞임) */}
        {placed?.hole && (
          <Pressable
            accessible={false}
            onPress={handleNext}
            style={{
              position: 'absolute',
              left: placed.hole.x,
              top: placed.hole.y,
              width: placed.hole.width,
              height: placed.hole.height,
            }}
          />
        )}

        {/* 다음 장 카드는 화면 밖 자리에 숨겨 그려 높이만 잼. 다 재면 아래 보이는 카드가 한 번에 바뀜 */}
        {currentHole && placed?.index !== stepIndex && (
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 }}
            className="items-center px-6"
          >
            {renderCard(stepIndex, true, (next) => {
              // 같은 높이면 다시 그리지 않음
              if (cardHeight?.index === stepIndex && cardHeight.height === next) return
              setCardHeight({ index: stepIndex, height: next })
            })}
          </View>
        )}

        {/* 보이는 카드. 칸이 없는 장은 화면 가운데, 칸이 있는 장은 정해 둔 높이에 놓음
            넘기면 0.1초 동안 사라진 뒤 다음 카드로 바뀌고, 0.1초 동안 나타남 */}
        {placed && (
          <Animated.View
            pointerEvents="box-none"
            style={[
              {
                position: 'absolute',
                left: 0,
                right: 0,
                ...(placed.top === null
                  ? { top: 0, bottom: 0, justifyContent: 'center' as const }
                  : { top: placed.top }),
              },
              cardStyle,
            ]}
            className="items-center px-6"
          >
            {renderCard(placed.index, placed.hole !== null)}
          </Animated.View>
        )}
      </View>
    </Modal>
  )
}

type StepContentProps = {
  step: TourStep
  /** 화면을 짚는 장인지. 짚는 장은 큰 아이콘 대신 제목 옆에 작은 아이콘을 붙여 카드를 작게 둠 */
  hasHole: boolean
}

/** 안내 한 장의 아이콘 · 제목 · 설명 · 예시 칸 */
function StepContent({ step, hasHole }: StepContentProps) {
  const Icon = step.icon
  return (
    // 첫 장은 위아래 여백을 조금 더 둠
    <View className={`items-center gap-3 ${step.isIntro ? 'py-2' : ''}`}>
      {/* 화면을 짚지 않는 장만 큰 아이콘 원을 그림. 첫 장은 더 크게. 원은 파스텔 카드 위에서 보이게 흰색 */}
      {!hasHole && (
        <View
          className={`items-center justify-center rounded-full bg-bg-page ${
            step.isIntro ? 'size-20' : 'size-14'
          }`}
        >
          <Icon size={step.isIntro ? 40 : 28} color={COLORS['brand-primary']} />
        </View>
      )}
      {/* 짚는 장은 제목 앞에 작은 아이콘을 붙여 장마다 무엇을 말하는지 먼저 보이게 함 */}
      <View className="flex-row items-center justify-center gap-2">
        {hasHole && (
          <View className="size-7 items-center justify-center rounded-full bg-bg-page">
            <Icon size={15} color={COLORS['brand-primary']} />
          </View>
        )}
        {/* 첫 장은 서비스 이름이라 크게 브랜드 색으로, 나머지 장은 기본 제목 크기로 씀 */}
        <KoreanText
          accessibilityRole="header"
          className={`shrink text-center font-bold ${
            step.isIntro ? 'text-[28px] text-brand-primary' : 'text-[18px] text-text-primary'
          }`}
        >
          {step.title}
        </KoreanText>
      </View>
      {/* 첫 장은 body가 한 줄 소개라 흰 알약 배지로, 나머지 장은 설명 문단으로 씀. \n에서 줄을 바꿈 */}
      {step.isIntro ? (
        <View className="rounded-full bg-bg-page px-3 py-1">
          <Text className="font-semibold text-[14px] text-brand-primary">{step.body}</Text>
        </View>
      ) : (
        <KoreanText className="text-center font-sans text-[15px] leading-relaxed text-text-secondary">
          {step.body}
        </KoreanText>
      )}
      <ExampleBox step={step} />
    </View>
  )
}

/** 마커 예시 · 핵심 기능 · 범례를 흰 칸 하나에 묶고 사이에 가는 선을 그음. 셋 다 없으면 그리지 않음 */
function ExampleBox({ step }: { step: TourStep }) {
  const sections: { key: string; node: ReactNode }[] = []
  // 마커 예시가 있으면 지도 마커처럼 생긴 알약 옆에 뜻을 적음
  if (step.markerExample) {
    const { text, className, caption } = step.markerExample
    sections.push({
      key: 'marker',
      node: (
        <View className="flex-row items-center gap-3">
          <View className={`min-w-[44px] items-center rounded-full px-2.5 py-1 ${className}`}>
            <Text className="font-bold text-[14px] text-text-on-brand">{text}</Text>
          </View>
          <KoreanText className="flex-1 font-medium text-[15px] text-text-primary">
            {caption}
          </KoreanText>
        </View>
      ),
    })
  }
  // 핵심 기능이 있으면 아이콘 + 한 줄씩 왼쪽 정렬로. 문단보다 한눈에 읽힘
  if (step.points) {
    sections.push({
      key: 'points',
      node: (
        <View className="gap-3">
          {step.points.map(({ icon: PointIcon, text, note }) => (
            <View key={text} className="flex-row items-center gap-3">
              <View className="size-8 items-center justify-center rounded-full bg-brand-primary-bg">
                <PointIcon size={16} color={COLORS['brand-primary']} />
              </View>
              {/* 덧붙임이 있으면 글 바로 아래에 작은 회색 글씨로 붙여, 어느 기능의 단서인지 바로 보이게 함 */}
              <View className="flex-1 gap-0.5">
                <KoreanText className="font-medium text-[15px] text-text-primary">
                  {text}
                </KoreanText>
                {note && (
                  <KoreanText className="font-sans text-[12px] text-text-secondary">
                    {note}
                  </KoreanText>
                )}
              </View>
            </View>
          ))}
        </View>
      ),
    })
  }
  // 범례가 있으면 색 점과 이름을 한 줄에 고르게 놓음
  if (step.legend) {
    sections.push({
      key: 'legend',
      node: (
        <View className="flex-row flex-wrap justify-around gap-2">
          {step.legend.map(({ label, className }) => (
            <View key={label} className="flex-row items-center gap-1.5">
              <View className={`size-3 rounded-full ${className}`} />
              <Text className="font-semibold text-[15px] text-text-primary">{label}</Text>
            </View>
          ))}
        </View>
      ),
    })
  }
  // 보여 줄 것이 없으면 칸도 그리지 않음
  if (sections.length === 0) return null
  return (
    <View className="mt-1 w-full gap-3 rounded-md bg-bg-page px-4 py-3.5">
      {sections.map(({ key, node }, index) => (
        <Fragment key={key}>
          {/* 둘째 묶음부터 위에 가는 선을 그어 나눔 */}
          {index > 0 && <View className="h-px bg-border-default" />}
          {node}
        </Fragment>
      ))}
    </View>
  )
}
