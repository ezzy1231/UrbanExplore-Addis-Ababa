import type { AdminKpiDelta } from './admin-kpi-card'

/**
 * Shared helpers for windowed admin analytics (overview + metrics).
 * Server-safe — no "use client" — so server components can call them.
 */

export const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const
export type RangeKey = keyof typeof RANGE_DAYS

export function parseRange(value: string | undefined): RangeKey {
  return value === '7d' || value === '90d' ? value : '30d'
}

/** ISO instant for the start of the UTC day `offsetDays` ago. */
export function startOfUtcDay(offsetDays: number): string {
  const now = new Date()
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offsetDays))
  return date.toISOString()
}

export type DayBucket = { key: string; label: string; value: number }

/** Empty per-day buckets for the last `days` UTC days, oldest first. */
export function dayBuckets(days: number): DayBucket[] {
  const now = new Date()
  const buckets: DayBucket[] = []
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - index))
    buckets.push({
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      value: 0,
    })
  }
  return buckets
}

/** Sum rows into per-day buckets across the last `days` days. */
export function bucketSeries(days: number, rows: Array<{ day: string; value: number }>) {
  const buckets = dayBuckets(days)
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))
  for (const row of rows) {
    const bucket = byKey.get(row.day)
    if (bucket) bucket.value += row.value
  }
  return buckets.map(({ label, value }) => ({ label, value }))
}

/** Signed percentage change between adjacent windows, as a KPI delta chip. */
export function periodDelta(current: number, previous: number, days: number): AdminKpiDelta {
  const comparison = `vs previous ${days} days`
  if (current === 0 && previous === 0) return { direction: 'flat', label: '0%', comparison }
  if (previous === 0) {
    return {
      direction: current > 0 ? 'up' : 'flat',
      label: `+${current}`,
      comparison: 'first activity in window',
    }
  }
  const percent = Math.round(((current - previous) / previous) * 100)
  if (percent === 0) return { direction: 'flat', label: '0%', comparison }
  return {
    direction: percent > 0 ? 'up' : 'down',
    label: `${percent > 0 ? '+' : '-'}${Math.abs(percent)}%`,
    comparison,
  }
}
