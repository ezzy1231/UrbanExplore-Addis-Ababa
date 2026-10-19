import Link from 'next/link'
import {
  Activity,
  Building2,
  CalendarCheck,
  CalendarDays,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type AdminActivityItem = {
  id: string
  action: string
  actor: string
  entityType: string | null
  entityId: string | null
  createdAt: string
}

function entityIcon(entityType: string | null): LucideIcon {
  switch (entityType) {
    case 'business':
      return Building2
    case 'organizer':
      return ShieldCheck
    case 'event':
      return CalendarDays
    case 'reservation':
      return CalendarCheck
    case 'profile':
      return UserRound
    default:
      return Activity
  }
}

function actionTone(action: string): { tile: string; dot: string } {
  if (/rejected|suspend|cancel|failed|delete/.test(action)) {
    return { tile: 'bg-danger/12 text-danger', dot: 'bg-danger' }
  }
  if (/approved|verified|confirm|reinstate|published|created/.test(action)) {
    return { tile: 'bg-success/12 text-success', dot: 'bg-success' }
  }
  return { tile: 'bg-console-indigo-soft text-console-indigo', dot: 'bg-console-indigo' }
}

function humanize(action: string): string {
  const words = action.replace(/[._]/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function relativeTime(iso: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`
  if (minutes < 60 * 24 * 7) return `${Math.round(minutes / 1440)}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'SY'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function AdminActivityFeed({
  items,
  href,
  className,
}: {
  items: AdminActivityItem[]
  href: string
  className?: string
}) {
  return (
    <section
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-console-border bg-console-card shadow-console-card',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-console-border px-5 py-4">
        <div>
          <h2 className="text-[15px] font-bold text-console-ink">Audit activity</h2>
          <p className="mt-0.5 text-xs text-console-muted">Latest administrative and partner events</p>
        </div>
        <Link
          href={href}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-console-indigo transition-colors hover:bg-console-indigo-soft"
        >
          Full log
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-console-bg text-console-muted">
            <Activity className="size-5" strokeWidth={1.9} aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-semibold text-console-ink">No activity recorded</p>
          <p className="mt-1 text-xs text-console-muted">
            Administrative actions will stream in here.
          </p>
        </div>
      ) : (
        <ol className="max-h-[420px] flex-1 divide-y divide-console-border overflow-y-auto">
          {items.map((item) => {
            const Icon = entityIcon(item.entityType)
            const tone = actionTone(item.action)
            return (
              <li key={item.id} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-console-bg/50">
                <span
                  aria-hidden="true"
                  className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', tone.tile)}
                >
                  <Icon className="size-4" strokeWidth={2.1} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13px] font-semibold leading-snug text-console-ink">
                    <span className={cn('size-1.5 shrink-0 rounded-full', tone.dot)} aria-hidden="true" />
                    <span className="truncate">{humanize(item.action)}</span>
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-console-muted">
                    <span className="font-medium text-console-ink/80">{item.actor}</span>
                    {item.entityType && ` · ${item.entityType}`}
                    {item.entityId && <span className="font-mono"> #{item.entityId.slice(0, 8)}</span>}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    aria-hidden="true"
                    className="flex size-6 items-center justify-center rounded-full bg-console-bg text-[9px] font-bold text-console-muted"
                    title={item.actor}
                  >
                    {initials(item.actor)}
                  </span>
                  <time dateTime={item.createdAt} className="whitespace-nowrap text-[10px] tabular-nums text-console-muted">
                    {relativeTime(item.createdAt)}
                  </time>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
