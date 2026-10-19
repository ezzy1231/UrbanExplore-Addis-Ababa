'use client'

/**
 * Recharts drawing half of the admin chart cards. Code-split from
 * `console-chart.tsx` so the ~380 KB chart bundle only loads on routes that
 * actually render a chart.
 *
 * Recharts writes stroke/tick fill to SVG presentation attributes, where var()
 * does not resolve. The console palette is deliberately fixed-light, so these
 * are literal token values rather than CSS variables.
 */

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const CHART = {
  accent: '#1C3A64',
  grid: '#EDEFF5',
  tick: '#7A8296',
  surface: '#FFFFFF',
} as const

type ChartPoint = { label: string; value: number }

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`
  return String(value)
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean
  payload?: Array<{ value?: number }>
  label?: string
  unit: string
}) {
  if (!active || !payload?.length) return null
  const value = Number(payload[0].value ?? 0)
  return (
    <div className="rounded-xl border border-console-border bg-console-card px-3 py-2 shadow-elevate">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-console-muted">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-console-ink">
        {value.toLocaleString('en-US')}{' '}
        <span className="text-[11px] font-medium text-console-muted">{unit}</span>
      </p>
    </div>
  )
}

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; payload?: { color?: string } }>
}) {
  if (!active || !payload?.length) return null
  const slice = payload[0]
  return (
    <div className="rounded-xl border border-console-border bg-console-card px-3 py-2 shadow-elevate">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-console-muted">
        <span
          aria-hidden="true"
          className="size-2 rounded-full"
          style={{ backgroundColor: slice.payload?.color ?? CHART.accent }}
        />
        {slice.name}
      </p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-console-ink">
        {Number(slice.value ?? 0).toLocaleString('en-US')}
      </p>
    </div>
  )
}

export function AreaBarCanvas({
  points,
  domainMax,
  ticks,
  gradientId,
  unit,
  kind,
}: {
  points: ChartPoint[]
  domainMax: number
  ticks: number[]
  gradientId: string
  unit: string
  kind: 'area' | 'bar'
}) {
  const defs = (
    <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={CHART.accent} stopOpacity={kind === 'bar' ? 0.9 : 0.26} />
        <stop offset="100%" stopColor={CHART.accent} stopOpacity={kind === 'bar' ? 0.55 : 0.02} />
      </linearGradient>
    </defs>
  )

  const axes = (
    <>
      <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="4 4" />
      <XAxis
        dataKey="label"
        axisLine={false}
        tickLine={false}
        interval="preserveStartEnd"
        minTickGap={26}
        tick={{ fill: CHART.tick, fontSize: 11 }}
        dy={6}
      />
      <YAxis
        domain={[0, domainMax]}
        ticks={ticks}
        axisLine={false}
        tickLine={false}
        width={42}
        tick={{ fill: CHART.tick, fontSize: 11 }}
        tickFormatter={compact}
      />
      <Tooltip
        cursor={
          kind === 'bar'
            ? { fill: 'rgb(28 58 100 / 0.06)' }
            : { stroke: CHART.accent, strokeWidth: 1, strokeDasharray: '3 3' }
        }
        content={<ChartTooltip unit={unit} />}
      />
    </>
  )

  if (kind === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          {defs}
          {axes}
          <Bar
            dataKey="value"
            fill={`url(#${gradientId})`}
            radius={[6, 6, 0, 0]}
            maxBarSize={30}
            animationDuration={550}
          />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        {defs}
        {axes}
        <Area
          type="monotone"
          dataKey="value"
          stroke={CHART.accent}
          strokeWidth={2.4}
          fill={`url(#${gradientId})`}
          activeDot={{ r: 4, fill: CHART.accent, strokeWidth: 0 }}
          dot={false}
          animationDuration={600}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function DonutCanvas({
  data,
}: {
  data: Array<{ label: string; value: number; color: string }>
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius="64%"
          outerRadius="92%"
          paddingAngle={3}
          cornerRadius={6}
          stroke={CHART.surface}
          strokeWidth={2}
          animationDuration={550}
        >
          {data.map((slice) => (
            <Cell key={slice.label} fill={slice.color} />
          ))}
        </Pie>
        <Tooltip content={<DonutTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  )
}
