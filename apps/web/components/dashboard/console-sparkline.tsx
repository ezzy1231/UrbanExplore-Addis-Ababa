'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

const TONES = {
  indigo: '#1C3A64',
  mint: '#0D825A',
  danger: '#C42B1C',
} as const

/**
 * Compact trend line for KPI cards. Fixed data-to-pixel scaling is not the
 * point here — the card prints the value and the signed delta, and this is the
 * supporting shape. The stroke stays 2px at any width (`non-scaling-stroke`),
 * and the gradient id is instance-scoped so two cards never collide.
 */
export function MiniSparkline({
  points,
  tone = 'indigo',
  className,
}: {
  points: number[]
  tone?: keyof typeof TONES
  className?: string
}) {
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const gradientId = `mini-spark-${instanceId}`
  const stroke = TONES[tone]

  const width = 220
  const height = 52
  const values = points.length > 1 ? points : [0, points[0] ?? 0]
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = Math.max(max - min, 1)
  const step = width / (values.length - 1)

  const coords = values.map((value, index) => {
    const x = index * step
    const y = height - 5 - ((value - min) / span) * (height - 10)
    return [x, y] as const
  })
  const line = coords
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Trend over the selected period"
      className={cn('h-12 w-full', className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
