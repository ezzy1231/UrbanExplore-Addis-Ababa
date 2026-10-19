'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Ban,
  ChevronDown,
  EyeOff,
  Loader2,
  RotateCcw,
  Send,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  adminCancelReservation,
  adminModerateEvent,
  adminSetBusinessActive,
  adminSetUserSuspended,
  adminSetUserRole,
} from '@/app/dashboard/actions'
import { toast } from './console-toast'

/**
 * Client controls for the admin panel's inline mutations. Each wraps a guarded
 * server action with useTransition, reports the outcome as a toast, then
 * refreshes the relevant server-rendered data.
 *
 * The success string returned by every action used to be discarded; it is now
 * the toast title so a decision is never silent.
 *
 * Verification decisions deliberately do NOT live here: partners are approved
 * or declined only from the Verification queue, where the reviewer sees the
 * submitted documents and must leave a note. These controls cover moderation
 * (suspension, event lifecycle, bookings, roles).
 */

const chip =
  'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:opacity-50'
const chipOk = `${chip} border-success/40 bg-success/15 text-success hover:bg-success/25`
const chipBad = `${chip} border-danger/40 bg-danger/15 text-danger hover:bg-danger/25`
const chipNeutral = `${chip} border-console-border bg-console-card text-console-muted hover:border-console-indigo/30 hover:text-console-ink`

function Busy() {
  return <Loader2 aria-hidden="true" className="size-3.5 animate-spin" strokeWidth={2.4} />
}

/** Semantic icon while idle, spinner while the action is in flight. */
function ActionIcon({ pending, icon: Icon }: { pending: boolean; icon: LucideIcon }) {
  if (pending) return <Busy />
  return <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.3} />
}

function reportFailure(message: string, fallback = 'Please try again.') {
  toast.error('Action failed', message || fallback)
}

const ROLE_OPTIONS = [
  { value: 'customer', label: 'Customer' },
  { value: 'food_business', label: 'Food business' },
  { value: 'event_organizer', label: 'Event organizer' },
  { value: 'system_admin', label: 'System admin' },
]

export function UserRoleSelect({ userId, currentRole }: { userId: string; currentRole: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function change(next: string) {
    if (next === currentRole) return
    startTransition(async () => {
      const result = await adminSetUserRole(userId, next)
      if (!result.ok) {
        reportFailure(result.message)
        return
      }
      toast.success(result.message)
      router.refresh()
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative inline-flex items-center">
        <select
          value={currentRole}
          disabled={pending}
          onChange={(event) => change(event.target.value)}
          aria-label="User role"
          className="h-9 appearance-none rounded-lg border border-console-border bg-console-card pl-3 pr-8 text-xs font-semibold text-console-ink transition-colors hover:border-console-indigo/30 focus:border-console-indigo/50 disabled:opacity-50"
        >
          {ROLE_OPTIONS.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 size-3.5 text-console-muted"
          strokeWidth={2.3}
        />
      </span>
      {pending && <Busy />}
    </span>
  )
}

export function EventModerationActions({
  eventId,
  status,
}: {
  eventId: string
  status: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function act(action: 'publish' | 'unpublish' | 'cancel') {
    if (action === 'cancel' && !window.confirm('Cancel this event?')) return
    startTransition(async () => {
      const result = await adminModerateEvent(eventId, action)
      if (!result.ok) {
        reportFailure(result.message)
        return
      }
      toast.success(result.message)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {(status === 'draft' || status === 'cancelled') && (
        <button type="button" disabled={pending} onClick={() => act('publish')} className={chipOk}>
          <ActionIcon pending={pending} icon={Send} />
          {pending ? 'Publishing…' : 'Publish'}
        </button>
      )}
      {status === 'published' && (
        <button type="button" disabled={pending} onClick={() => act('unpublish')} className={chipNeutral}>
          <ActionIcon pending={pending} icon={EyeOff} />
          {pending ? 'Unpublishing…' : 'Unpublish'}
        </button>
      )}
      {(status === 'published' || status === 'draft') && (
        <button type="button" disabled={pending} onClick={() => act('cancel')} className={chipBad}>
          <ActionIcon pending={pending} icon={X} />
          Cancel
        </button>
      )}
    </div>
  )
}

export function ReservationCancelAction({
  reservationId,
  status,
}: {
  reservationId: string
  status: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  function cancel() {
    if (!window.confirm('Cancel this reservation?')) return
    startTransition(async () => {
      const result = await adminCancelReservation(reservationId)
      if (!result.ok) {
        reportFailure(result.message)
        return
      }
      toast.success(result.message)
      setDone(true)
      router.refresh()
    })
  }

  if (done || (status !== 'pending' && status !== 'confirmed')) return null

  return (
    <button type="button" disabled={pending} onClick={cancel} className={chipBad}>
      <ActionIcon pending={pending} icon={X} />
      {pending ? 'Cancelling…' : 'Cancel booking'}
    </button>
  )
}

export function UserSuspensionActions({
  userId,
  isSuspended,
}: {
  userId: string
  isSuspended: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function toggle() {
    if (!isSuspended && !window.confirm('Suspend this user?')) return
    startTransition(async () => {
      const result = await adminSetUserSuspended(userId, !isSuspended)
      if (!result.ok) {
        reportFailure(result.message)
        return
      }
      toast.success(result.message)
      router.refresh()
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={pending} onClick={toggle} className={isSuspended ? chipOk : chipBad}>
        <ActionIcon pending={pending} icon={isSuspended ? RotateCcw : Ban} />
        {isSuspended ? (pending ? 'Reinstating…' : 'Reinstate') : pending ? 'Suspending…' : 'Suspend'}
      </button>
    </span>
  )
}

export function BusinessSuspendAction({
  businessId,
  status,
}: {
  businessId: string
  status: string
}) {
  const [pending, startTransition] = useTransition()

  // moderation_status has no 'suspended'; suspension maps to 'inactive'.
  const suspended = status === 'inactive'
  if (status === 'pending' || status === 'rejected') return null

  function toggle() {
    if (!suspended && !window.confirm('Suspend this business?')) return
    startTransition(async () => {
      const result = await adminSetBusinessActive(businessId, suspended)
      if (!result.ok) {
        reportFailure(result.message)
        return
      }
      toast.success(result.message)
      window.location.reload()
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={pending} onClick={toggle} className={suspended ? chipOk : chipNeutral}>
        <ActionIcon pending={pending} icon={suspended ? RotateCcw : Ban} />
        {suspended ? (pending ? 'Reactivating…' : 'Reactivate') : pending ? 'Suspending…' : 'Suspend'}
      </button>
    </span>
  )
}
