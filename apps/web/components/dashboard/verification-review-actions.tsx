'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { reviewVerificationRequest } from '@/app/dashboard/actions'
import {
  CONSOLE_PRIMARY_BUTTON,
  CONSOLE_SECONDARY_BUTTON,
} from '@/components/dashboard/console-tokens'
import { toast } from './console-toast'

/**
 * The admin's decision on one queued request.
 *
 * Approve is the action that actually makes a partner public:
 * private.business_is_public / private.organizer_is_public require
 * status = 'active' AND is_verified = true together, so the action writes both.
 *
 * A note is mandatory for every decision except "start review" — a partner who
 * is declined with no explanation has no way to fix anything and no reason to
 * try again.
 */

const DECISIONS = [
  { value: 'start_review', label: 'Start review', primary: false },
  { value: 'needs_info', label: 'Request more info', primary: false },
  { value: 'approve', label: 'Approve', primary: true },
  { value: 'reject', label: 'Decline', primary: false },
] as const

export default function VerificationReviewActions({
  requestId,
  status,
}: {
  requestId: string
  status: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [pendingDecision, setPendingDecision] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const isOpen = ['pending', 'in_review', 'needs_info'].includes(status)
  const visible = isOpen
    ? DECISIONS
    : DECISIONS.filter((decision) => decision.value === 'start_review')

  function decide(decision: string, label: string) {
    setPendingDecision(decision)
    startTransition(async () => {
      const result = await reviewVerificationRequest(requestId, decision, note)
      setPendingDecision(null)
      if (!result.ok) {
        toast.error(`${label} failed`, result.message || 'Please try again.')
        return
      }
      toast.success(result.message)
      setNote('')
      router.refresh()
    })
  }

  if (!isOpen) {
    return (
      <div className="rounded-xl bg-console-bg px-4 py-3 text-sm text-console-muted">
        This request was decided and is kept as history. A new submission from
        this partner will create a new request.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-console-muted">
        Reviewer note (required to approve, decline, or ask for more)
        <textarea
          rows={3}
          value={note}
          maxLength={2000}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What you checked, and anything the partner should know."
          className="mt-1.5 w-full rounded-xl border border-console-border bg-white px-3.5 py-2.5 text-sm text-console-ink outline-none transition focus:border-console-indigo/50 focus:ring-2 focus:ring-console-indigo/10"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {visible.map((decision) => {
          const working = pending && pendingDecision === decision.value
          return (
            <button
              key={decision.value}
              type="button"
              disabled={pending}
              onClick={() => decide(decision.value, decision.label)}
              className={`${
                decision.primary ? CONSOLE_PRIMARY_BUTTON : CONSOLE_SECONDARY_BUTTON
              } disabled:opacity-60`}
            >
              {working && (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" strokeWidth={2.4} />
              )}
              {working ? 'Working…' : decision.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
