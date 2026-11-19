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

/** 위치(%)에 글자를 두는 정렬. 양 끝은 막대 밖으로 나가지 않게 안쪽으로 붙임 */
function alignAt(percent: number) {
  if (percent < 8) return 'translate-x-0'
  if (percent > 92) return '-translate-x-full'
  return '-translate-x-1/2'
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
    <div className="flex w-full flex-col gap-2">
      <div className="relative h-2 rounded-full bg-bg-subtle" aria-hidden>
        <div
          className="absolute inset-y-0 min-w-2 rounded-full bg-brand-primary"
          style={{ left: `${start}%`, width: `${end - start}%` }}
        />
        {/* 원은 구간 끝(P90)에 둬서 '길면 이 정도까지 기다림'을 가리킴 */}
        <div
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-primary bg-bg-page"
          style={{ left: `${end}%` }}
        />
      </div>
      {/* 눈금과 원 밑 대기시간을 한 줄에 두어 글자 높이를 맞춤 */}
      <div className="relative h-4 text-[11px] text-text-secondary" aria-hidden>
        {TICKS.map((tick) =>
          // 대기 끝이 이 눈금의 숨김 구간 안이면 그리지 않음
          p90 >= tick.hideFrom && p90 <= tick.hideTo ? null : (
            <span
              key={tick.percent}
              className={`absolute top-0 whitespace-nowrap ${alignAt(tick.percent)}`}
              style={{ left: `${tick.percent}%` }}
            >
              {tick.label}
            </span>
          ),
        )}
        <span
          className={`absolute top-0 text-xs font-medium whitespace-nowrap text-brand-primary ${alignAt(end)}`}
          style={{ left: `${end}%` }}
        >
          {p90}분
        </span>
      </div>
    </div>
  )
}
