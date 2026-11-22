import type { DimensionValue } from 'react-native'
import { Text, View } from 'react-native'

/** 축 최대값. 이보다 긴 대기는 끝 칸에 붙여 "40분+"로 읽음 */
const MAX_MINUTES = 40

/** 칸 하나가 맡는 분과 칸 수 */
const BLOCK_MINUTES = 5
const BLOCK_COUNT = MAX_MINUTES / BLOCK_MINUTES

/** 막대 아래 눈금. 위치(%) · 글자 */
const TICKS = [
  { percent: 0, label: '0분' },
  { percent: 50, label: `${MAX_MINUTES / 2}분` },
  { percent: 100, label: `${MAX_MINUTES}분+` },
]

/** 시작 · 끝 글자와 이만큼(%) 가까운 눈금은 글자가 겹치므로 숨김 */
const TICK_HIDE_DISTANCE = 20

/** 둘째 칸의 위치(0~1). 초록은 첫 칸만 쓰고 여기서부터 빨강까지 이어 섞음 */
const SECOND_BLOCK_AT = 1 / (BLOCK_COUNT - 1)

/**
 * 칸 색. 위치(0~1)마다 HSL(색상 · 채도 · 밝기). 첫 칸은 초록, 둘째 칸 노랑에서 마지막 칸 빨강까지 이어짐
 * RGB로 섞으면 중간이 탁해져서 색상(hue)을 돌려 섞음
 */
const FILL_STOPS = [
  { at: 0, hsl: [145, 63, 42] },
  { at: SECOND_BLOCK_AT, hsl: [45, 92, 50] },
  { at: 1, hsl: [0, 72, 57] },
]

/** 시작 · 끝 글자 색. 칸 색은 흰 바탕 글자로 흐려서 같은 위치의 진한 색을 씀 */
const TEXT_STOPS = [
  { at: 0, hsl: [145, 70, 30] },
  { at: SECOND_BLOCK_AT, hsl: [38, 90, 34] },
  { at: 1, hsl: [0, 65, 45] },
]

/** 보통(P50)까지 칸의 투명도 */
const LIGHT_ALPHA = 0.3

/** 글자 칸 너비. 눈금 글자보다 넉넉하게 잡고 그 안에서 정렬함 */
const LABEL_BOX_WIDTH = 80

/** 0~1 위치의 색. 위치를 감싸는 두 색 사이를 섞음 */
function colorAt(stops: typeof FILL_STOPS, t: number, alpha = 1) {
  const clamped = Math.min(Math.max(t, 0), 1)
  const index = Math.max(stops.findIndex((stop) => stop.at >= clamped) - 1, 0)
  const from = stops[index]
  const to = stops[index + 1]
  const local = (clamped - from.at) / (to.at - from.at)
  const [h, s, l] = from.hsl.map((value, i) => Math.round(value + (to.hsl[i] - value) * local))
  return `hsla(${h}, ${s}%, ${l}%, ${alpha})`
}

/**
 * 위치(%)에 글자 칸을 두는 모양. 양 끝은 막대 밖으로 나가지 않게 안쪽으로 붙임
 * RN transform은 %를 못 써서(웹의 -translate-x-1/2) 고정 너비 칸을 놓고 칸 안에서 정렬함
 */
function labelBoxAt(percent: number) {
  // 왼쪽 끝 근처면 위치에서 오른쪽으로 펼침
  if (percent < 8) {
    return { left: `${percent}%` as DimensionValue, alignItems: 'flex-start' as const }
  }
  // 오른쪽 끝 근처면 위치에서 왼쪽으로 펼침
  if (percent > 92) {
    return { right: `${100 - percent}%` as DimensionValue, alignItems: 'flex-end' as const }
  }
  return {
    left: `${percent}%` as DimensionValue,
    marginLeft: -LABEL_BOX_WIDTH / 2,
    alignItems: 'center' as const,
  }
}

type WaitRangeBarProps = {
  p50: number
  p90: number
}

/**
 * 예상 대기를 5분 칸 8개(0~40분+)로 표시
 * 보통(P50)까지는 연한 칸, 길면(P90)까지는 진한 칸, 칸 색은 길수록 초록에서 빨강
 */
export function WaitRangeBar({ p50, p90 }: WaitRangeBarProps) {
  // 길면(P90)까지 채울 칸 수. 40분이 넘으면 마지막 칸까지 채우고 글자만 실제 분
  const filledCount = Math.min(Math.ceil(p90 / BLOCK_MINUTES), BLOCK_COUNT)
  const end = (filledCount / BLOCK_COUNT) * 100
  const lastIndex = Math.max(filledCount - 1, 0)
  // 연한 칸이 끝나는 분. P50과 P90이 같으면 구간이 없어 0분부터 진하게 이어 채움
  const lightUntil = p50 < p90 ? p50 : 0
  // 보통(P50)까지 연한 칸 수. 연한 칸이 끝나는 곳에 대기 시작 글자를 둠
  const lightCount = Math.min(Math.ceil(lightUntil / BLOCK_MINUTES), BLOCK_COUNT)
  const start = (lightCount / BLOCK_COUNT) * 100
  // 0분이면 0분 눈금과 같고, 끝 글자와 같은 자리면 겹쳐서 시작 글자는 빼고 끝만 보여 줌
  const isStartShown = lightCount > 0 && start < end
  const labelPositions = isStartShown ? [start, end] : [end]

  return (
    <View className="w-full gap-2">
      <View className="flex-row gap-[3px]">
        {Array.from({ length: BLOCK_COUNT }, (_, index) => {
          const blockStart = index * BLOCK_MINUTES
          const t = index / (BLOCK_COUNT - 1)
          // 보통까지는 연하게, 길면까지는 진하게, 그 뒤는 빈 칸
          const backgroundColor =
            blockStart < lightUntil
              ? colorAt(FILL_STOPS, t, LIGHT_ALPHA)
              : blockStart < p90
                ? colorAt(FILL_STOPS, t)
                : undefined
          return (
            <View
              key={index}
              className="h-2.5 flex-1 rounded-[3px] bg-bg-subtle"
              style={backgroundColor ? { backgroundColor } : undefined}
            />
          )
        })}
      </View>
      {/* 눈금과 대기 시작 · 끝 글자를 한 줄에 두어 글자 높이를 맞춤 */}
      <View className="relative h-4">
        {TICKS.map((tick) =>
          // 대기 시작 · 끝 글자와 가까운 눈금은 그리지 않음
          labelPositions.some(
            (position) => Math.abs(tick.percent - position) < TICK_HIDE_DISTANCE,
          ) ? null : (
            <View
              key={tick.percent}
              className="absolute top-0"
              style={{ width: LABEL_BOX_WIDTH, ...labelBoxAt(tick.percent) }}
            >
              <Text numberOfLines={1} className="font-sans text-[11px] text-text-secondary">
                {tick.label}
              </Text>
            </View>
          ),
        )}
        {isStartShown && (
          <View className="absolute top-0" style={{ width: LABEL_BOX_WIDTH, ...labelBoxAt(start) }}>
            <Text
              numberOfLines={1}
              className="font-medium text-xs"
              style={{ color: colorAt(TEXT_STOPS, (lightCount - 1) / (BLOCK_COUNT - 1)) }}
            >
              {p50}분
            </Text>
          </View>
        )}
        <View className="absolute top-0" style={{ width: LABEL_BOX_WIDTH, ...labelBoxAt(end) }}>
          <Text
            numberOfLines={1}
            className="font-medium text-xs"
            style={{ color: colorAt(TEXT_STOPS, lastIndex / (BLOCK_COUNT - 1)) }}
          >
            {p90}분
          </Text>
        </View>
      </View>
    </View>
  )
}
