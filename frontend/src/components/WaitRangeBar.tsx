/** 축 최대값. 이보다 긴 대기는 끝에 붙여 "40분+"로 읽음 */
const MAX_MINUTES = 40

type WaitRangeBarProps = {
  p50: number
  p90: number
}

/** 예상 대기 구간(P50~P90)을 0~40분+ 축 위에 표시 */
export function WaitRangeBar({ p50, p90 }: WaitRangeBarProps) {
  const toPercent = (minutes: number) => (Math.min(minutes, MAX_MINUTES) / MAX_MINUTES) * 100
  const start = toPercent(p50)
  const end = toPercent(p90)

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="relative h-2 rounded-full bg-bg-subtle" aria-hidden>
        <div
          className="absolute inset-y-0 min-w-2 rounded-full bg-brand-primary"
          style={{ left: `${start}%`, width: `${end - start}%` }}
        />
        <div
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-primary bg-bg-page"
          style={{ left: `${start}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-text-secondary" aria-hidden>
        <span>0분</span>
        <span>{MAX_MINUTES / 2}분</span>
        <span>{MAX_MINUTES}분+</span>
      </div>
    </div>
  )
}
