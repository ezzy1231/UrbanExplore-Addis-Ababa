import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  ConsolePageShell,
  ConsoleHeader,
  StatusPill,
} from '@/components/dashboard/console'
import { statusTone } from '@/components/dashboard/console-shared'
import { CONSOLE_CARD } from '@/components/dashboard/console-tokens'
import { AdminBackLink } from '@/components/dashboard/admin-back-link'
import { ReservationCancelAction } from '@/components/dashboard/admin-actions'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Reservation detail · Admin' }

export default async function AdminReservationDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  const { data: reservation } = await supabase
    .from('reservations')
    .select(
      `id, status, reservation_date, time_slot, guest_count, user_id, created_at,
       branches(branch_name, businesses(name))`
    )
    .eq('id', params.id)
    .maybeSingle()

  if (!reservation) notFound()
  const r = reservation as unknown as {
    id: string
    status: string
    reservation_date: string
    time_slot: string | null
    guest_count: number | null
    user_id: string | null
    created_at: string | null
    branches: { branch_name: string | null; businesses: { name: string }[] | { name: string } | null }[] | null
  }
  const branch = r.branches?.[0] ?? null
  const businessName = branch?.businesses
    ? Array.isArray(branch.businesses)
      ? branch.businesses[0]?.name ?? ''
      : branch.businesses.name
    : ''

  // Guest contact via the admin-scoped RPC.
  let guestEmail: string | null = null
  if (r.user_id) {
    const { data: contacts } = await supabase.rpc('partner_customer_contacts', {
      p_user_ids: [r.user_id],
    })
    guestEmail =
      ((contacts ?? []) as Array<{ id: string; email: string | null }>)[0]?.email ?? null
  }

  return (
    <ConsolePageShell maxWidth="max-w-3xl">
      <AdminBackLink href="/dashboard/admin/reservations">Back to reservations</AdminBackLink>

      <ConsoleHeader
        eyebrow="Reservation · admin view"
        title={`Party of ${r.guest_count ?? '—'}`}
        subtitle={guestEmail ?? 'Guest identity hidden'}
        action={<StatusPill status={r.status} tone={statusTone(r.status)} />}
      />

      <section className={cn(CONSOLE_CARD, 'divide-y divide-console-border text-sm')}>
        <div className="flex items-center justify-between gap-3 px-5 py-3.5">
          <span className="text-console-muted">Venue</span>
          <span className="truncate text-right font-semibold">
            {[businessName, branch?.branch_name].filter(Boolean).join(' · ') || '—'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-3.5">
          <span className="text-console-muted">Date</span>
          <span className="tabular-nums">
            {new Date(`${r.reservation_date}T00:00:00`).toLocaleDateString('en-GB', {
              weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
            })}
          </span>
        </div>
        {r.time_slot && (
          <div className="flex items-center justify-between gap-3 px-5 py-3.5">
            <span className="text-console-muted">Slot</span>
            <span className="tabular-nums">{r.time_slot}</span>
          </div>
        )}
        {r.created_at && (
          <div className="flex items-center justify-between gap-3 px-5 py-3.5">
            <span className="text-console-muted">Booked</span>
            <span className="tabular-nums text-console-muted">
              {new Date(r.created_at).toLocaleString('en-GB', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="text-xs text-console-muted">
            Cancelling a booking is recorded in the audit log.
          </p>
          <ReservationCancelAction reservationId={r.id} status={r.status} />
        </div>
      </section>

      <p className="px-1 text-xs tabular-nums text-console-muted">Ref {r.id}</p>
    </ConsolePageShell>
  )
}