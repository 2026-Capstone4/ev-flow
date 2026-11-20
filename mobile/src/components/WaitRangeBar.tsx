import type { DimensionValue } from 'react-native'
import { Text, View } from 'react-native'

/** 축 최대값. 이보다 긴 대기는 끝에 붙여 "40분+"로 읽음 */
const MAX_MINUTES = 40

/**
 * 막대 아래 눈금. 위치(%) · 글자, 그리고 대기 끝(P90, 분)이 hideFrom~hideTo면 대기시간 글자와 겹치므로 숨김
 * 40분+는 40분이 넘는 대기도 막대 끝에 붙으므로 끝 없이 35분부터 숨김
 */
const TICKS = [
  { percent: 0, label: '0분', hideFrom: 0, hideTo: 3 },
  { percent: 50, label: `${MAX_MINUTES / 2}분`, hideFrom: 15, hideTo: 25 },
  { percent: 100, label: `${MAX_MINUTES}분+`, hideFrom: 35, hideTo: Infinity },
]

/** 글자 칸 너비. 눈금 글자보다 넉넉하게 잡고 그 안에서 정렬함 */
const LABEL_BOX_WIDTH = 80

/** 막대 끝 원 지름 · 막대 높이 */
const KNOB_SIZE = 14
const BAR_HEIGHT = 8

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

/** 예상 대기 구간(P50~P90)을 0~40분+ 축 위에 표시 */
export function WaitRangeBar({ p50, p90 }: WaitRangeBarProps) {
  // 40분이 넘으면 위치는 막대 끝에 고정하고, 글자는 실제 분을 그대로 보여 줌
  const toPercent = (minutes: number) => (Math.min(minutes, MAX_MINUTES) / MAX_MINUTES) * 100
  const start = toPercent(p50)
  const end = toPercent(p90)

  return (
    <View className="w-full gap-2">
      <View className="relative h-2 rounded-full bg-bg-subtle">
        <View
          className="absolute inset-y-0 min-w-2 rounded-full bg-brand-primary"
          style={{ left: `${start}%`, width: `${end - start}%` }}
        />
        {/* 원은 구간 끝(P90)에 둬서 '길면 이 정도까지 기다림'을 가리킴 */}
        <View
          className="absolute rounded-full border-2 border-brand-primary bg-bg-page"
          style={{
            left: `${end}%`,
            top: (BAR_HEIGHT - KNOB_SIZE) / 2,
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            marginLeft: -KNOB_SIZE / 2,
          }}
        />
      </View>
      {/* 눈금과 원 밑 대기시간을 한 줄에 두어 글자 높이를 맞춤 */}
      <View className="relative h-4">
        {TICKS.map((tick) =>
          // 대기 끝이 이 눈금의 숨김 구간 안이면 그리지 않음
          p90 >= tick.hideFrom && p90 <= tick.hideTo ? null : (
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
        <View className="absolute top-0" style={{ width: LABEL_BOX_WIDTH, ...labelBoxAt(end) }}>
          <Text numberOfLines={1} className="font-medium text-xs text-brand-primary">
            {p90}분
          </Text>
        </View>
      </View>
    </View>
  )
}
