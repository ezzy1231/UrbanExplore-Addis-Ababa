'use client'

import { useId, useState } from 'react'
import dynamic from 'next/dynamic'
import { BarChart3, TrendingUp } from 'lucide-react'
import { formatCompactNumber, formatThousands } from '@/lib/console-format'
import { cn } from '@/lib/utils'

export type ConsoleChartPoint = { label: string; value: number }
/** One tab of the chart. `unit` overrides the card-level unit for this series. */
export type ConsoleChartSeriesEntry = { points: ConsoleChartPoint[]; unit?: string }
export type ConsoleChartSeries = Record<string, ConsoleChartSeriesEntry>

const AreaBarCanvas = dynamic(
  () => import('./console-chart-impl').then((mod) => mod.AreaBarCanvas),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-console-bg" />,
  },
)

const DonutCanvas = dynamic(
  () => import('./console-chart-impl').then((mod) => mod.DonutCanvas),
  {
    ssr: false,
    loading: () => <div className="mx-auto size-40 animate-pulse rounded-full bg-console-bg" />,
  },
)

function niceScale(maxValue: number, tickCount = 4) {
  if (maxValue <= 0) return { domainMax: tickCount, ticks: [0, 1, 2, 3, 4] }
  const rough = maxValue / tickCount
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
  const normalised = rough / magnitude
  const nice = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10
  const step = nice * magnitude
  const domainMax = Math.ceil(maxValue / step) * step
  const ticks = Array.from({ length: Math.round(domainMax / step) + 1 }, (_, index) =>
    Math.round(index * step),
  )
  return { domainMax, ticks }
}

export function ConsoleChartCard({
  title,
  subtitle,
  unit,
  series,
  kind = 'area',
  height = 260,
  className,
}: {
  title: string
  subtitle?: string
  unit: string
  /** One series per tab, keyed by its label. */
  series: ConsoleChartSeries
  kind?: 'area' | 'bar'
  height?: number
  className?: string
}) {
  const options = Object.keys(series)
  const [active, setActive] = useState(options[0] ?? '')
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const gradientId = `admin-chart-fill-${instanceId}`
  const activeEntry = active ? series[active] : undefined
  const points = activeEntry?.points ?? []
  const activeUnit = activeEntry?.unit ?? unit
  const hasData = points.some((point) => point.value > 0)
  const total = points.reduce((sum, point) => sum + point.value, 0)
  const peak = points.reduce((max, point) => Math.max(max, point.value), 0)
  const { domainMax, ticks } = niceScale(Math.max(peak, 1))

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-console-border bg-console-card shadow-console-card',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-console-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-console-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-console-muted">{subtitle}</p>}
        </div>

        {options.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-console-bg p-1" role="group" aria-label={`${title} series`}>
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setActive(option)}
                aria-pressed={active === option}
                className={cn(
                  'min-h-8 rounded-lg px-2.5 text-[11px] font-semibold transition-colors',
                  active === option
                    ? 'bg-console-card text-console-ink shadow-console-card'
                    : 'text-console-muted hover:text-console-ink',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        ) : (
          options[0] && (
            <span className="rounded-lg bg-console-bg px-2.5 py-1 text-[11px] font-semibold text-console-muted">
              {options[0]}
            </span>
          )
        )}
      </div>

      {hasData ? (
        <>
          <div className="w-full px-2 pt-4 sm:px-3" style={{ height }}>
            <AreaBarCanvas
              points={points}
              domainMax={domainMax}
              ticks={ticks}
              gradientId={gradientId}
              unit={activeUnit}
              kind={kind}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-console-border px-5 py-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-console-muted">
              <TrendingUp className="size-3.5 text-console-indigo" strokeWidth={2.3} aria-hidden="true" />
              Total
              <strong className="font-bold tabular-nums text-console-ink">
                {formatThousands(total)}
              </strong>
              {activeUnit}
            </span>
            <span className="text-console-muted">
              Peak{' '}
              <strong className="font-bold tabular-nums text-console-ink">
                {formatThousands(peak)}
              </strong>
            </span>
            <span className="ml-auto hidden text-console-muted sm:inline">
              Daily average{' '}
              <strong className="font-bold tabular-nums text-console-ink">
                {formatCompactNumber(Math.round(total / Math.max(points.length, 1)))}
              </strong>
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center" style={{ minHeight: height }}>
          <span className="flex size-10 items-center justify-center rounded-xl bg-console-bg text-console-muted">
            <BarChart3 className="size-5" strokeWidth={1.9} aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-semibold text-console-ink">No {activeUnit.toLowerCase()} in this window</p>
          <p className="mt-1 max-w-xs text-xs text-console-muted">
            Activity will chart here automatically once it lands.
          </p>
        </div>
      )}
    </section>
  )
}

const DONUT_COLORS = ['#1C3A64', '#166FBD', '#0D825A', '#A1690F', '#C22A6A'] as const

export function ConsoleDonutChart({
  title,
  subtitle,
  unit,
  data,
  className,
}: {
  title: string
  subtitle?: string
  unit: string
  data: Array<{ label: string; value: number }>
  className?: string
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const slices = data.map((item, index) => ({
    ...item,
    color: DONUT_COLORS[index % DONUT_COLORS.length],
  }))

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-console-border bg-console-card shadow-console-card',
        className,
      )}
    >
      <div className="border-b border-console-border px-5 py-4">
        <h2 className="text-[15px] font-bold text-console-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-console-muted">{subtitle}</p>}
      </div>

      {total > 0 ? (
        <div className="grid items-center gap-4 p-5 sm:grid-cols-[170px_1fr]">
          <div className="relative mx-auto size-[170px]">
            <DonutCanvas data={slices} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[26px] font-bold leading-none tabular-nums text-console-ink">
                {formatCompactNumber(total)}
              </span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-console-muted">
                {unit}
              </span>
            </div>
          </div>

          <ul className="min-w-0 space-y-2.5">
            {slices.map((slice) => {
              const percent = total > 0 ? Math.round((slice.value / total) * 100) : 0
              return (
                <li key={slice.label} className="flex items-center gap-2.5 text-xs">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-console-ink">
                    {slice.label}
                  </span>
                  <span className="tabular-nums font-bold text-console-ink">
                    {slice.value.toLocaleString('en-US')}
                  </span>
                  <span className="w-9 text-right tabular-nums text-console-muted">{percent}%</span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex size-10 items-center justify-center rounded-xl bg-console-bg text-console-muted">
            <BarChart3 className="size-5" strokeWidth={1.9} aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-semibold text-console-ink">Nothing to break down yet</p>
        </div>
      )}
    </section>
  )
}
