import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react'
import { MiniSparkline } from './console-sparkline'
import { cn } from '@/lib/utils'

export type AdminKpiTone = 'indigo' | 'mint' | 'sand' | 'sky' | 'blush'

const TONE: Record<AdminKpiTone, string> = {
  indigo: 'bg-console-indigo-soft text-console-indigo',
  mint: 'bg-console-mint text-console-mint-ink',
  sand: 'bg-console-sand text-console-sand-ink',
  sky: 'bg-console-sky text-console-sky-ink',
  blush: 'bg-console-blush text-console-blush-ink',
}

const SPARK_TONE: Record<AdminKpiTone, 'indigo' | 'mint' | 'danger'> = {
  indigo: 'indigo',
  mint: 'mint',
  sand: 'indigo',
  sky: 'indigo',
  blush: 'danger',
}

export type AdminKpiDelta = {
  direction: 'up' | 'down' | 'flat'
  /** Short signed value, e.g. `+12.4%` or `+18 new`. */
  label: string
  /** Context, e.g. `vs previous 30 days`. */
  comparison: string
}

export function AdminKpiCard({
  label,
  value,
  icon: Icon,
  tone = 'indigo',
  delta,
  sparkline,
  href,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  tone?: AdminKpiTone
  delta?: AdminKpiDelta
  sparkline?: number[]
  href?: string
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-console-muted">
          {label}
        </p>
        <span
          aria-hidden="true"
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105',
            TONE[tone],
          )}
        >
          <Icon className="size-[18px]" strokeWidth={2.1} />
        </span>
      </div>

      <p className="mt-2 text-[28px] font-bold leading-none tracking-tight text-console-ink tabular-nums">
        {typeof value === 'number' ? value.toLocaleString('en-US') : value}
      </p>

      {delta && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
              delta.direction === 'up' && 'bg-success/12 text-success',
              delta.direction === 'down' && 'bg-danger/12 text-danger',
              delta.direction === 'flat' && 'bg-console-bg text-console-muted',
            )}
          >
            {delta.direction === 'up' && <ArrowUpRight className="size-3" strokeWidth={2.6} aria-hidden="true" />}
            {delta.direction === 'down' && <ArrowDownRight className="size-3" strokeWidth={2.6} aria-hidden="true" />}
            {delta.direction === 'flat' && <Minus className="size-3" strokeWidth={2.6} aria-hidden="true" />}
            {delta.label}
          </span>
          <span className="text-[10px] font-medium text-console-muted">{delta.comparison}</span>
        </div>
      )}

      {sparkline && sparkline.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12">
          <MiniSparkline points={sparkline} tone={SPARK_TONE[tone]} className="h-12" />
        </div>
      )}
    </>
  )

  const className = cn(
    'group relative flex min-h-[148px] flex-col overflow-hidden rounded-2xl border border-console-border bg-console-card p-4 shadow-console-card transition-all duration-200',
    delta && sparkline ? 'pb-14' : 'pb-4',
    href && 'hover:-translate-y-0.5 hover:border-console-indigo/25 hover:shadow-elevate',
  )

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    )
  }

  return <div className={className}>{body}</div>
}
