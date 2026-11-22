import { ChargerStatusBar } from '@/components/ChargerStatusBar'
import { WaitRangeBar } from '@/components/WaitRangeBar'
import {
  formatWaitRange,
  getCongestionLabel,
  getCongestionNote,
  getWaitNote,
  isWaitUncertain,
} from '@ev-flow/core/lib/congestion'
import { findPrediction, getHorizonWhen } from '@ev-flow/core/lib/horizon'
import type { HorizonMinutes, Station } from '@ev-flow/core/types/station'

type HorizonSummaryProps = {
  station: Pick<
    Station,
    'availableChargers' | 'totalChargers' | 'chargers' | 'congestion' | 'predictions'
  >
  horizon: HorizonMinutes
}

/** 설명 줄 배열을 문장마다 줄을 나눠 그림 */
function NoteLines({ lines }: { lines: string[] }) {
  return (
    <p className="text-[13px] text-text-secondary">
      {lines.map((line, i) => (
        <span key={line}>
          {i > 0 && <br />}
          {line}
        </span>
      ))}
    </p>
  )
}

/** 상세 화면 혼잡 예측 칸 아래 설명. 지금은 사용 가능 대수, 15 · 30분 후는 예상 대기나 예상 혼잡 */
export function HorizonSummary({ station, horizon }: HorizonSummaryProps) {
  const prediction = findPrediction(station, horizon)

  // 지금 출발은 예상 대기 대신 실시간 사용 가능 대수와 상태 막대
  if (horizon === 0) {
    // 충전기가 모두 확인 불가면 빈 충전기가 없는 게 아니라 상태를 모르는 것
    const isAllUnknown =
      station.chargers.length > 0 && station.chargers.every((c) => c.status === 'unknown')
    return (
      <section className="flex flex-col gap-3">
        <h3 className="text-base font-bold">지금 사용 가능</h3>
        {/* 빈 충전기가 있으면 대수를 크게, 모두 확인 불가면 상태를 못 받았다고 안내, 그 밖에는 15 · 30분 예측을 보도록 안내 */}
        {station.availableChargers > 0 ? (
          <div className="flex flex-col gap-1">
            <p className="font-bold">
              <span className="text-[28px]">{station.availableChargers}대</span>
              <span className="text-sm text-text-secondary"> / 전체 {station.totalChargers}대</span>
            </p>
            {/* 1대뿐인 충전소는 비어 있어도 보통이라 이유를 알려 줌 */}
            {station.totalChargers === 1 && (
              <NoteLines lines={['충전기가 1대뿐이라 금방 찰 수 있어요']} />
            )}
          </div>
        ) : isAllUnknown ? (
          <div className="flex flex-col gap-1">
            <p className="text-lg font-bold text-text-secondary">상태 확인 불가</p>
            <NoteLines
              lines={[
                '지금은 충전기 상태를 받아오지 못했어요',
                '15분 후 · 30분 후 예측을 참고해보세요',
              ]}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-lg font-bold text-text-secondary">빈 충전기 없음</p>
            <NoteLines lines={['15분 후 · 30분 후의 예상 대기시간을 확인해보세요']} />
          </div>
        )}
        <ChargerStatusBar statuses={station.chargers.map((c) => c.status)} />
      </section>
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
      <section className="flex flex-col gap-3">
        <h3 className="text-base font-bold">{getHorizonWhen(horizon)} 예상 대기</h3>
        <div className="flex flex-col gap-1">
          <p className="text-[28px] font-bold">{waitRange}</p>
          {waitNote && <NoteLines lines={waitNote} />}
        </div>
        {/* 대기 예측을 믿기 어려우면 0분 막대도 숨김 */}
        {p50 !== null && p90 !== null && !isWaitUncertain(p90, prediction.congestion) && (
          <WaitRangeBar p50={p50} p90={p90} />
        )}
      </section>
    )
  }

  // 기준선이거나 대기 모델이 꺼져 있으면 혼잡도와 설명만 보여 줌
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-bold">{getHorizonWhen(horizon)} 예상 혼잡</h3>
      <div className="flex flex-col gap-1">
        {/* 예측이 없으면 지금 출발의 상태 확인 불가처럼 작은 회색 글씨 */}
        {prediction.congestion ? (
          <p className="text-[28px] font-bold">{getCongestionLabel(prediction.congestion)}</p>
        ) : (
          <p className="text-lg font-bold text-text-secondary">{getCongestionLabel(null)}</p>
        )}
        <NoteLines lines={getCongestionNote(prediction.congestion, station.totalChargers)} />
      </div>
    </section>
  )
}
