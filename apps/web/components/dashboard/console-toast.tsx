'use client'

import { useSyncExternalStore } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Console toast store + viewport.
 *
 * The repo has no toast dependency, so this is a small external store rather
 * than a context provider. Any client component inside the console can import
 * `toast` and fire a message without knowing where the viewport is mounted;
 * `ConsoleShell` renders exactly one `<ConsoleToaster />` inside `.shell-console`
 * so every toast inherits the console palette.
 *
 * Accessibility: each toast owns a live role (`alert` for failures, `status`
 * for everything else), the close button has a real 36px target, and the
 * progress bar is not the only signal that the toast will disappear.
 */

export type ConsoleToastVariant = 'success' | 'error' | 'info' | 'warning'

type ConsoleToastItem = {
  id: string
  variant: ConsoleToastVariant
  title: string
  description?: string
  duration: number
}

type ToastOptions = { duration?: number }

const DEFAULT_DURATION = 4500
const MAX_VISIBLE = 4
const EMPTY: ConsoleToastItem[] = []

let items: ConsoleToastItem[] = EMPTY
const listeners = new Set<() => void>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function emit() {
  for (const listener of listeners) listener()
}

function clearTimer(id: string) {
  const timer = timers.get(id)
  if (timer) clearTimeout(timer)
  timers.delete(id)
}

function dismiss(id: string) {
  clearTimer(id)
  const next = items.filter((item) => item.id !== id)
  if (next.length === items.length) return
  items = next.length ? next : EMPTY
  emit()
}

function push(
  variant: ConsoleToastVariant,
  title: string,
  description?: string,
  options?: ToastOptions,
) {
  const duration = options?.duration ?? DEFAULT_DURATION
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const next = [...items, { id, variant, title, description, duration }]

  // Trim oldest entries (and their timers) so a burst of actions cannot
  // cover the screen or leave orphaned timeouts behind.
  if (next.length > MAX_VISIBLE) {
    for (const stale of next.slice(0, next.length - MAX_VISIBLE)) clearTimer(stale.id)
  }

  items = next.slice(-MAX_VISIBLE)
  emit()
  timers.set(
    id,
    setTimeout(() => dismiss(id), duration),
  )
  return id
}

export const toast = {
  success(title: string, description?: string, options?: ToastOptions) {
    return push('success', title, description, options)
  },
  error(title: string, description?: string, options?: ToastOptions) {
    return push('error', title, description, options)
  },
  info(title: string, description?: string, options?: ToastOptions) {
    return push('info', title, description, options)
  },
  warning(title: string, description?: string, options?: ToastOptions) {
    return push('warning', title, description, options)
  },
  dismiss,
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return items
}

function getServerSnapshot() {
  return EMPTY
}

const VARIANT: Record<
  ConsoleToastVariant,
  { icon: typeof CheckCircle2; surface: string; bar: string }
> = {
  success: {
    icon: CheckCircle2,
    surface: 'bg-console-mint text-console-mint-ink',
    bar: 'bg-success',
  },
  error: {
    icon: XCircle,
    surface: 'bg-danger/12 text-danger',
    bar: 'bg-danger',
  },
  warning: {
    icon: AlertTriangle,
    surface: 'bg-console-sand text-console-sand-ink',
    bar: 'bg-warning',
  },
  info: {
    icon: Info,
    surface: 'bg-console-indigo-soft text-console-indigo',
    bar: 'bg-console-indigo',
  },
}

function ToastCard({ item }: { item: ConsoleToastItem }) {
  const { icon: Icon, surface, bar } = VARIANT[item.variant]

  return (
    <div
      role={item.variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'animate-toast-in pointer-events-auto relative overflow-hidden rounded-xl border border-console-border bg-console-card shadow-elevate',
      )}
    >
      <div className="flex items-start gap-3 p-3.5 pr-10">
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
            surface,
          )}
        >
          <Icon className="size-[17px]" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-snug text-console-ink">{item.title}</p>
          {item.description && (
            <p className="mt-0.5 text-xs leading-relaxed text-console-muted">{item.description}</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label="Dismiss notification"
        className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-lg text-console-muted transition-colors hover:bg-console-bg hover:text-console-ink"
      >
        <X className="size-4" strokeWidth={2.2} />
      </button>

      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-console-border/60">
        <span
          className={cn('toast-progress block h-full origin-left', bar)}
          style={{ animationDuration: `${item.duration}ms` }}
        />
      </span>
    </div>
  )
}

export function ConsoleToaster() {
  const toasts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return (
    <div
      aria-label="Activity notifications"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(calc(100vw-2rem),380px)] flex-col-reverse gap-2"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  )
}
