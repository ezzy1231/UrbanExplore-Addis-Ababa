'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { setBusinessVerification } from '@/app/dashboard/actions'
import { toast } from './console-toast'

/**
 * Inline verify/reject controls for the admin overview's pending-verification
 * rows. The decision is confirmed with a toast, then the pending row drops out
 * on the next server render.
 */
export function BusinessVerificationActions({ businessId }: { businessId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <span role="status" className="text-xs font-semibold text-success">
        Decision saved
      </span>
    )
  }

  function act(approve: boolean) {
    if (!approve && !window.confirm('Reject this business verification?')) return
    startTransition(async () => {
      const result = await setBusinessVerification(businessId, approve)
      if (!result.ok) {
        toast.error('Action failed', result.message || 'Please try again.')
        return
      }
      toast.success(result.message)
      setDone(true)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => act(true)}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-success/40 bg-success/15 px-4 text-xs font-semibold uppercase tracking-wide text-success transition-colors hover:bg-success/25 disabled:opacity-50"
      >
        {pending && <Loader2 aria-hidden="true" className="size-3.5 animate-spin" strokeWidth={2.4} />}
        {pending ? 'Saving…' : 'Verify'}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => act(false)}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-danger/40 bg-danger/15 px-4 text-xs font-semibold uppercase tracking-wide text-danger transition-colors hover:bg-danger/25 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  )
}
