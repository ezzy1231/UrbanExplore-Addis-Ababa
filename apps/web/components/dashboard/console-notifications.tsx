'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Bell,
  BellOff,
  CalendarCheck,
  CalendarDays,
  CheckCheck,
  CreditCard,
  Loader2,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { markNotificationsRead } from '@/app/plans/actions'
import type { ConsumerNotification } from '@/lib/supabase/queries'
import { cn } from '@/lib/utils'
import { toast } from './console-toast'

type NotificationFilter = 'all' | 'unread'

const TYPE_STYLE: Array<{ match: RegExp; icon: LucideIcon; tone: string }> = [
  { match: /verify|verification|document/i, icon: ShieldCheck, tone: 'bg-console-sand text-console-sand-ink' },
  { match: /pay|ticket|purchase|refund/i, icon: CreditCard, tone: 'bg-console-sky text-console-sky-ink' },
  { match: /event|reminder/i, icon: CalendarDays, tone: 'bg-console-blush text-console-blush-ink' },
  { match: /reserv|booking|table/i, icon: CalendarCheck, tone: 'bg-console-mint text-console-mint-ink' },
  { match: /account|profile|user/i, icon: UserRound, tone: 'bg-console-indigo-soft text-console-indigo' },
  { match: /welcome|system/i, icon: Sparkles, tone: 'bg-console-indigo-soft text-console-indigo' },
]

function styleFor(notification: ConsumerNotification) {
  const haystack = `${notification.type} ${notification.title}`
  return TYPE_STYLE.find((entry) => entry.match.test(haystack)) ?? {
    icon: Bell,
    tone: 'bg-console-indigo-soft text-console-indigo',
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diff) || diff < 45_000) return 'just now'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export function ConsoleNotificationBell({
  initialCount = 0,
  settingsHref,
}: {
  initialCount?: number
  settingsHref: string
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const [notifications, setNotifications] = useState<ConsumerNotification[]>([])
  const [unread, setUnread] = useState(initialCount)
  const [loading, setLoading] = useState(false)
  const [loadedOnce, setLoadedOnce] = useState(false)
  const [error, setError] = useState(false)
  const [marking, setMarking] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/notifications/user', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnread(data.unread ?? 0)
      setLoadedOnce(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    buttonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  useEffect(() => {
    if (!open) return
    fetchNotifications()
  }, [open, fetchNotifications])

  // Keep the badge honest while the tab is open, but never poll a hidden tab.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNotifications()
    }, 60_000)
    return () => clearInterval(id)
  }, [fetchNotifications])

  async function markOne(id: string) {
    const previous = notifications
    setNotifications((current) =>
      current.map((item) =>
        item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    )
    setUnread((count) => Math.max(0, count - 1))
    try {
      const nextUnread = await markNotificationsRead(id)
      setUnread(nextUnread)
    } catch {
      setNotifications(previous)
      setUnread((count) => count + 1)
      toast.error('Could not mark notification as read', 'Please try again.')
    }
  }

  async function markAll() {
    setMarking(true)
    try {
      const nextUnread = await markNotificationsRead()
      setUnread(nextUnread)
      setNotifications((current) =>
        current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
      )
      toast.success('All caught up', 'Every notification is marked as read.')
    } catch {
      toast.error('Could not mark all as read', 'Please try again.')
    } finally {
      setMarking(false)
    }
  }

  const visible = filter === 'unread'
    ? notifications.filter((item) => !item.readAt)
    : notifications
  const unreadInList = notifications.filter((item) => !item.readAt).length

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative flex size-10 items-center justify-center rounded-xl text-console-muted transition-colors hover:bg-console-bg hover:text-console-ink"
      >
        <Bell className="size-[19px]" strokeWidth={2.1} />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-[#D9363E] px-1 text-[10px] font-bold leading-[18px] text-white ring-2 ring-console-card"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          className="animate-pop-in absolute right-0 top-full z-50 mt-2 w-[min(calc(100vw-2rem),380px)] overflow-hidden rounded-2xl border border-console-border bg-console-card shadow-elevate"
        >
          <div className="flex items-center justify-between gap-3 border-b border-console-border px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-bold text-console-ink">Notifications</h2>
              {unread > 0 && (
                <span className="rounded-full bg-console-indigo-soft px-2 py-0.5 text-[10px] font-bold tabular-nums text-console-indigo">
                  {unread} new
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={fetchNotifications}
              disabled={loading}
              aria-label="Refresh notifications"
              className="flex size-9 items-center justify-center rounded-lg text-console-muted transition-colors hover:bg-console-bg hover:text-console-ink disabled:opacity-50"
            >
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} strokeWidth={2.2} />
            </button>
          </div>

          <div className="flex items-center gap-1 border-b border-console-border bg-console-bg/60 px-3 py-2">
            {(['all', 'unread'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                aria-pressed={filter === option}
                className={cn(
                  'min-h-8 rounded-lg px-3 text-[11px] font-semibold capitalize transition-colors',
                  filter === option
                    ? 'bg-console-card text-console-ink shadow-console-card'
                    : 'text-console-muted hover:text-console-ink',
                )}
              >
                {option}
                {option === 'unread' && unreadInList > 0 ? ` · ${unreadInList}` : ''}
              </button>
            ))}
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                disabled={marking}
                className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-console-indigo transition-colors hover:bg-console-indigo-soft disabled:opacity-50"
              >
                {marking ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2.4} />
                ) : (
                  <CheckCheck className="size-3.5" strokeWidth={2.4} />
                )}
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[min(26rem,60vh)] overflow-y-auto">
            {loading && !loadedOnce ? (
              <div className="space-y-2 p-3" role="status" aria-label="Loading notifications">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="flex animate-pulse items-start gap-3 rounded-xl p-2">
                    <span className="size-8 shrink-0 rounded-lg bg-console-bg" />
                    <span className="flex-1 space-y-2">
                      <span className="block h-3 w-2/3 rounded bg-console-bg" />
                      <span className="block h-2.5 w-full rounded bg-console-bg" />
                    </span>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-semibold text-console-ink">Could not load notifications</p>
                <p className="mt-1 text-xs text-console-muted">Check your connection and try again.</p>
                <button
                  type="button"
                  onClick={fetchNotifications}
                  className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-console-border px-3 text-xs font-semibold text-console-ink transition-colors hover:bg-console-bg"
                >
                  <RefreshCw className="size-3.5" strokeWidth={2.2} />
                  Retry
                </button>
              </div>
            ) : visible.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-console-bg text-console-muted">
                  <BellOff className="size-5" strokeWidth={1.9} />
                </span>
                <p className="mt-3 text-sm font-semibold text-console-ink">
                  {filter === 'unread' ? 'No unread notifications' : 'You are all caught up'}
                </p>
                <p className="mt-1 text-xs text-console-muted">
                  {filter === 'unread'
                    ? 'Everything here has been read.'
                    : 'New platform activity will appear here.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-console-border">
                {visible.map((item) => {
                  const { icon: Icon, tone } = styleFor(item)
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => !item.readAt && markOne(item.id)}
                        disabled={Boolean(item.readAt)}
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                          item.readAt ? 'bg-console-bg/35' : 'hover:bg-console-bg/70',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
                            tone,
                          )}
                        >
                          <Icon className="size-4" strokeWidth={2.1} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start gap-2">
                            <span
                              className={cn(
                                'min-w-0 flex-1 text-xs font-bold leading-snug',
                                item.readAt ? 'text-console-muted' : 'text-console-ink',
                              )}
                            >
                              {item.title}
                            </span>
                            {!item.readAt && (
                              <span
                                aria-label="Unread"
                                className="mt-1 size-1.5 shrink-0 rounded-full bg-console-indigo"
                              />
                            )}
                          </span>
                          {item.body && (
                            <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-console-muted">
                              {item.body}
                            </span>
                          )}
                          <span className="mt-1.5 block text-[10px] font-medium text-console-muted">
                            {timeAgo(item.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-console-border bg-console-bg/40 px-3 py-2">
            <Link
              href={settingsHref}
              onClick={() => setOpen(false)}
              className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-[11px] font-semibold text-console-muted transition-colors hover:text-console-ink"
            >
              <Settings className="size-3.5" strokeWidth={2.2} />
              Notification settings
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
