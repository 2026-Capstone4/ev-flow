import { View } from 'react-native'
import { Text } from './Text'
import {
  formatWaitRange,
  getCongestionLabel,
  getCongestionNote,
  getWaitNote,
  isWaitUncertain,
} from '@ev-flow/core/lib/congestion'
import { findPrediction, getHorizonWhen } from '@ev-flow/core/lib/horizon'
import type { HorizonMinutes, Station } from '@ev-flow/core/types/station'
import { ChargerStatusBar } from './ChargerStatusBar'
import { WaitRangeBar } from './WaitRangeBar'

type HorizonSummaryProps = {
  station: Pick<
    Station,
    | 'availableChargers'
    | 'totalChargers'
    | 'chargers'
    | 'congestion'
    | 'predictions'
    | 'predictionAvailable'
  >
  horizon: HorizonMinutes
}

/** 설명 줄 배열을 문장마다 줄을 나눠 그림 */
function NoteLines({ lines }: { lines: string[] }) {
  return <Text className="font-sans text-[14px] text-text-secondary">{lines.join('\n')}</Text>
}

/** 상세 화면 혼잡 예측 칸 아래 설명. 지금은 사용 가능 대수, 15 · 30분 후는 예상 대기나 예상 혼잡 (웹 HorizonSummary와 같음) */
export function HorizonSummary({ station, horizon }: HorizonSummaryProps) {
  const prediction = findPrediction(station, horizon)

  // 지금 출발은 예상 대기 대신 실시간 사용 가능 대수와 상태 막대
  if (horizon === 0) {
    // 충전기가 모두 확인 불가면 빈 충전기가 없는 게 아니라 상태를 모르는 것
    const isAllUnknown =
      station.chargers.length > 0 && station.chargers.every((c) => c.status === 'unknown')
    // 상태는 알지만 빈 충전기가 없으면 제목에서 바로 알려 줌
    const isNoneAvailable = station.availableChargers === 0 && !isAllUnknown
    return (
      <View className="gap-3">
        <Text className="font-bold text-base text-text-primary">
          {isNoneAvailable ? '사용 가능한 충전기가 없어요' : '지금 사용 가능'}
        </Text>
        {/* 빈 충전기가 있으면 대수를 크게, 모두 확인 불가면 상태를 못 받았다고 안내, 그 밖에는 15 · 30분 예측을 보도록 안내 */}
        {station.availableChargers > 0 ? (
          <View className="gap-1">
            {/* Android는 안쪽 작은 글자의 줄 높이로 줄 전체를 그려 큰 숫자가 잘려서, 큰 숫자에 맞춘 줄 높이를 바깥에 둠 */}
            <Text className="font-bold leading-[36px] text-text-primary">
              <Text className="text-[28px]">{station.availableChargers}대</Text>
              <Text className="text-sm text-text-secondary"> / 전체 {station.totalChargers}대</Text>
            </Text>
            {/* 1대뿐인 충전소는 비어 있어도 보통이라 이유를 알려 줌 */}
            {station.totalChargers === 1 && (
              <NoteLines lines={['충전기가 1대뿐이라 금방 찰 수 있어요']} />
            )}
          </View>
        ) : isAllUnknown ? (
          <View className="gap-1">
            <Text className="font-bold text-lg text-text-secondary">상태 확인 불가</Text>
            <NoteLines
              lines={[
                '지금은 충전기 상태를 받아오지 못했어요',
                '15분 후 · 30분 후 예측을 참고해보세요',
              ]}
            />
          </View>
        ) : (
          // 제목이 이미 빈 충전기가 없다고 알려서 큰 글씨 없이 안내만 둠
          <NoteLines lines={['15분 후 · 30분 후의 예상 대기시간을 확인해보세요']} />
        )}
        <ChargerStatusBar statuses={station.chargers.map((c) => c.status)} />
      </View>
    )
  }

  // 서버가 이 시점 예측을 보내지 않았으면 칸을 그리지 않음
  if (!prediction) return null

  const p50 = prediction.waitTimeP50Minutes
  const p90 = prediction.waitTimeP90Minutes
  const waitRange = formatWaitRange(p50, p90, prediction.congestion)

  // 대기 예측이 있으면 예상 대기
  if (waitRange) {
    const waitNote = getWaitNote(p50, p90, prediction.congestion)
    return (
      <View className="gap-3">
        <Text className="font-bold text-base text-text-primary">
          {getHorizonWhen(horizon)} 도착 시 예상 대기시간
        </Text>
        <View className="gap-1">
          <Text className="font-bold text-[28px] text-text-primary">{waitRange}</Text>
          {waitNote && <NoteLines lines={waitNote} />}
        </View>
        {/* 대기 예측을 믿기 어려우면 0분 막대도 숨김 */}
        {p50 !== null && p90 !== null && !isWaitUncertain(p90, prediction.congestion) && (
          <WaitRangeBar p50={p50} p90={p90} />
        )}
      </View>
    )
  }

  // 기준선이거나 대기 모델이 꺼져 있으면 혼잡도와 설명만 보여 줌
  return (
    <View className="gap-3">
      <Text className="font-bold text-base text-text-primary">
        {getHorizonWhen(horizon)} 예상 혼잡
      </Text>
      <View className="gap-1">
        {/* 예측이 없으면 지금 출발의 상태 확인 불가처럼 작은 회색 글씨 */}
        {prediction.congestion ? (
          <Text className="font-bold text-[28px] text-text-primary">
            {getCongestionLabel(prediction.congestion)}
          </Text>
        ) : (
          <Text className="font-bold text-lg text-text-secondary">{getCongestionLabel(null)}</Text>
        )}
        <NoteLines
          lines={getCongestionNote(
            prediction.congestion,
            station.totalChargers,
            station.predictionAvailable,
          )}
        />
      </View>
    </View>
  )
}
