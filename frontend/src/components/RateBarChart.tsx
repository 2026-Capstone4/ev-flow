import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatPercent } from '@/lib/admin/common'

export type RateDatum = {
  label: string
  /** 0~1. null이면 막대 없음 (관측 · 실행 없음) */
  rate: number | null
  /** 툴팁 둘째 줄 (예: 관측 2,280건) */
  detail: string
}

type RateBarChartProps = {
  data: RateDatum[]
  /** 막대 색 (CSS 색 값). 막대마다 다르게 칠할 때 씀 */
  getColor: (rate: number) => string
  /** x축 글자를 몇 칸마다 보여 줄지. 24시간은 다 쓰면 겹쳐서 건너뜀 */
  tickInterval?: number
  /** y축 최댓값 (0~1). 결측률처럼 작은 값은 줄여야 막대가 보임 */
  maxRate?: number
  /**
   * 차트 높이(px). 'fill'이면 부모(세로 flex)의 남는 높이를 채우고 최소 180px
   * 부모 높이가 정해지지 않은 좁은 화면에서는 180px로 보임
   */
  height?: number | 'fill'
  /** 스크린리더용 차트 설명 */
  ariaLabel: string
}

/** y축 눈금 6개 (0부터 top을 5% 단위로 올린 값까지 5등분). 예: 0.1 → 0 · 2 · 4 · 6 · 8 · 10% */
function getTicks(top: number) {
  // 나눗셈 오차(2.0000000001 등)로 한 단계 더 올라가지 않게 아주 작은 값을 빼고 올림
  const roundedTop = Math.min(1, Math.ceil(top / 0.05 - 1e-9) * 0.05)
  return [0, 1, 2, 3, 4, 5].map((i) => (roundedTop * i) / 5)
}

/** 비율 막대 차트 — 이용률 · 결측률 공통 */
export function RateBarChart({
  data,
  getColor,
  tickInterval = 0,
  maxRate = 1,
  height = 180,
  ariaLabel,
}: RateBarChartProps) {
  // 최댓값을 줄인 차트(결측률)는 눈금을 직접 정함 — 자동 눈금(2.5% · 7.5%)이 정수로 반올림돼 3% · 8%로 보이던 문제
  // 막대가 최댓값을 넘으면 5% 단위로 올려서 막대가 잘리지 않게 하고, 5등분해 눈금이 늘 정수 %가 되게 함
  const ticks =
    maxRate < 1 ? getTicks(Math.max(maxRate, ...data.map((d) => d.rate ?? 0))) : undefined
  return (
    // 'fill'은 바깥 상자가 남는 높이를 차지하고, 차트는 그 상자에 절대 위치로 꽉 채움
    // (퍼센트 높이는 부모 높이가 정해지지 않으면 0이 되어서 절대 위치로 맞춤)
    <div
      role="img"
      aria-label={ariaLabel}
      className={height === 'fill' ? 'relative min-h-[180px] flex-1' : undefined}
      style={height === 'fill' ? undefined : { height }}
    >
      {/* 'fill'일 때만 절대 위치 상자로 감쌈. 아니면 바깥 상자를 그대로 100% 채움 */}
      <div className={height === 'fill' ? 'absolute inset-0' : 'h-full'}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="label"
              interval={tickInterval}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border-default)' }}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
            />
            <YAxis
              domain={[0, ticks ? ticks[ticks.length - 1] : maxRate]}
              ticks={ticks}
              tickFormatter={(value: number) => formatPercent(value)}
              tickLine={false}
              axisLine={false}
              width={40}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-bg-subtle)' }}
              content={({ active, payload }) => {
                // 막대 위에 있지 않으면 툴팁 숨김
                if (!active || !payload?.length) return null
                const datum = payload[0].payload as RateDatum
                return (
                  <div className="rounded-sm border border-border-default bg-bg-page px-3 py-2 text-xs shadow-sm">
                    <p className="font-bold">
                      {datum.label} ·{' '}
                      {datum.rate === null ? '집계 전' : formatPercent(datum.rate, 1)}
                    </p>
                    <p className="text-text-secondary">{datum.detail}</p>
                  </div>
                )
              }}
            />
            <Bar dataKey="rate" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {data.map((datum) => (
                <Cell
                  key={datum.label}
                  fill={datum.rate === null ? 'transparent' : getColor(datum.rate)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
