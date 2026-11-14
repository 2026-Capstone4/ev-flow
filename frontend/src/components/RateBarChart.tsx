import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatPercent } from '@/lib/admin'

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
  height?: number
  /** 스크린리더용 차트 설명 */
  ariaLabel: string
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
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
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
            domain={[0, maxRate]}
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
                    {datum.label} · {datum.rate === null ? '집계 전' : formatPercent(datum.rate, 1)}
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
  )
}
