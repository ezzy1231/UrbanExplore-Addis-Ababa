import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Banknote, EyeOff, Ticket, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  ConsolePageShell,
  ConsoleHeader,
  SectionTitle,
  StatusPill,
} from '@/components/dashboard/console'
import { CONSOLE_SURFACE, statusTone } from '@/components/dashboard/console-shared'
import { CONSOLE_CARD } from '@/components/dashboard/console-tokens'
import { AdminBackLink } from '@/components/dashboard/admin-back-link'
import { AdminKpiCard } from '@/components/dashboard/admin-kpi-card'
import { EventModerationActions } from '@/components/dashboard/admin-actions'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Event detail · Admin' }

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default async function AdminEventDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select(
      `id, title, description, category, venue_name, starts_at, end_date_time,
       price_label, status, is_active, created_at, organizer_id,
       organizers(id, name)`
    )
    .eq('id', params.id)
    .maybeSingle()

  if (!event) notFound()
  const e = event as unknown as {
    id: string
    title: string
    description: string | null
    category: string | null
    venue_name: string | null
    starts_at: string | null
    end_date_time: string | null
    price_label: string | null
    status: string
    is_active: boolean | null
    created_at: string | null
    organizer_id: string
    organizers: { id: string; name: string }[] | { id: string; name: string } | null
  }
  const organizer = Array.isArray(e.organizers) ? e.organizers[0] : e.organizers

  const [tiersRes, purchasesRes] = await Promise.all([
    supabase
      .from('ticket_types')
      .select('id, name, tier, price, total_quantity, remaining_quantity, sales_start, sales_end')
      .eq('event_id', e.id)
      .limit(100),
    supabase
      .from('ticket_purchases')
      .select('id, quantity, amount, payment_status, attended, created_at')
      .eq('event_id', e.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const tiers = (tiersRes.data ?? []) as Array<{
    id: string; name: string; tier: string; price: number
    total_quantity: number; remaining_quantity: number
    sales_start: string | null; sales_end: string | null
  }>
  const recentPurchases = (purchasesRes.data ?? []) as Array<{
    id: string; quantity: number | null; amount: number | null
    payment_status: string; attended: boolean | null; created_at: string
  }>

  const capacity = tiers.reduce((s, t) => s + (Number(t.total_quantity) || 0), 0)
  const remaining = tiers.reduce((s, t) => s + (Number(t.remaining_quantity) || 0), 0)

  // Sum over ALL purchases for honest totals.
  const { data: allPurchases } = await supabase
    .from('ticket_purchases')
    .select('quantity, amount, payment_status')
    .eq('event_id', e.id)
    .limit(5000)
  let ticketsSold = 0
  let revenuePaid = 0
  for (const p of (allPurchases ?? []) as Array<{ quantity: number | null; amount: number | null; payment_status: string }>) {
    ticketsSold += Number(p.quantity) || 0
    if (p.payment_status === 'paid') revenuePaid += Number(p.amount) || 0
  }

  const kpis = [
    { label: 'Tickets sold', value: String(ticketsSold), icon: Ticket, tone: 'mint' as const },
    { label: 'Capacity left', value: String(remaining), icon: Users, tone: 'sky' as const },
    { label: 'Paid revenue', value: `ETB ${revenuePaid.toLocaleString('en-US')}`, icon: Banknote, tone: 'sand' as const },
  ]

  return (
    <ConsolePageShell>
      <AdminBackLink href="/dashboard/admin/events">Back to events</AdminBackLink>

      <ConsoleHeader
        eyebrow="Event · admin view"
        title={e.title}
        action={<EventModerationActions eventId={e.id} status={e.status} />}
      />

      <section
        className={cn(
          CONSOLE_CARD,
          'flex flex-wrap items-center gap-3 p-4 text-sm',
          e.status === 'cancelled' && 'border-danger/40 bg-danger/5',
        )}
      >
        <StatusPill status={e.status} tone={statusTone(e.status)} />
        {!e.is_active && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-console-bg px-2.5 py-1 text-[11px] font-bold text-console-muted">
            <EyeOff aria-hidden="true" className="size-3.5" strokeWidth={2.3} />
            Hidden from catalogue
          </span>
        )}
        {organizer && (
          <Link
            href={`/dashboard/admin/organizers/${organizer.id}`}
            className="text-console-muted underline underline-offset-2 hover:text-console-ink"
          >
            by {organizer.name}
          </Link>
        )}
      </section>

      {/* Details */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className={cn(CONSOLE_CARD, 'space-y-2 p-5 text-sm')}>
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-console-muted">When &amp; where</h2>
          <p>Starts: {formatDateTime(e.starts_at)}</p>
          {e.end_date_time && <p className="text-console-muted">Ends: {formatDateTime(e.end_date_time)}</p>}
          {e.venue_name && <p className="text-console-muted">{e.venue_name}</p>}
          {e.category && <p className="capitalize text-console-muted">{e.category}</p>}
          {e.price_label && (
            <p className="font-bold tabular-nums text-console-indigo">{e.price_label}</p>
          )}
        </div>
        <div className={cn(CONSOLE_CARD, 'space-y-2 p-5 text-sm')}>
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-console-muted">About</h2>
          <p className="leading-relaxed text-console-muted">{e.description ?? 'No description provided.'}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <AdminKpiCard key={kpi.label} label={kpi.label} value={kpi.value} icon={kpi.icon} tone={kpi.tone} />
        ))}
      </section>

      {/* Ticket tiers */}
      <section className="space-y-3">
        <SectionTitle>Ticket tiers</SectionTitle>
        <p className="text-xs text-app-muted">Showing up to 100 ticket tiers.</p>
        {tiers.length === 0 ? (
          <div className={cn(CONSOLE_SURFACE, 'border-dashed p-8 text-center')}>
            <p className="text-sm text-app-muted">No ticket tiers configured for this event.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tiers.map((t) => {
              const pct =
                t.total_quantity > 0
                  ? Math.round(((t.total_quantity - t.remaining_quantity) / t.total_quantity) * 100)
                  : 0
              return (
                <div key={t.id} className={cn(CONSOLE_CARD, 'p-4')}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{t.name}</p>
                      <p className="text-xs capitalize text-console-muted">{t.tier} tier</p>
                    </div>
                    <span className="shrink-0 text-base font-bold tabular-nums text-console-indigo">
                      ETB {Number(t.price).toLocaleString('en-US')}
                    </span>
                  </div>
                  <div aria-hidden className="mt-3 h-2 overflow-hidden rounded-full bg-console-bg">
                    <div className="h-full rounded-full bg-console-indigo" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs tabular-nums text-console-muted">
                    {t.remaining_quantity} of {t.total_quantity} left ({pct}% sold)
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Recent purchases */}
      <section className="space-y-3">
        <SectionTitle>Recent purchases</SectionTitle>
        {/* Mobile — stacked cards */}
        <div className="space-y-2 md:hidden">
          {recentPurchases.length === 0 ? (
            <div className={cn(CONSOLE_SURFACE, 'p-6 text-center text-sm text-app-muted')}>
              No ticket sales yet.
            </div>
          ) : (
            recentPurchases.map((p) => (
              <div key={p.id} className={cn(CONSOLE_CARD, 'space-y-2.5 p-4')}>
                <p className="font-bold tabular-nums text-console-indigo">
                  ETB {Number(p.amount ?? 0).toLocaleString('en-US')}
                </p>
                <p className="text-xs text-app-muted">
                  {new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </p>

                <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <dt className="text-app-muted">Qty</dt>
                    <dd className="tabular-nums">{p.quantity ?? '—'}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <dt className="text-app-muted">Payment</dt>
                    <dd>
                      <StatusPill status={p.payment_status} tone={statusTone(p.payment_status)} />
                    </dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <dt className="text-app-muted">Attended</dt>
                    <dd className="text-app-muted">{p.attended ? '✓' : '—'}</dd>
                  </div>
                </dl>
              </div>
            ))
          )}
        </div>

        {/* Desktop */}
        <div className={cn(CONSOLE_CARD, 'hidden overflow-x-auto md:block')}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-console-border text-[11px] uppercase tracking-[0.14em] text-console-muted">
                <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                <th scope="col" className="px-4 py-3 font-semibold">Qty</th>
                <th scope="col" className="px-4 py-3 font-semibold">Amount</th>
                <th scope="col" className="px-4 py-3 font-semibold">Payment</th>
                <th scope="col" className="px-4 py-3 font-semibold">Attended</th>
              </tr>
            </thead>
            <tbody>
              {recentPurchases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-app-muted">
                    No ticket sales yet.
                  </td>
                </tr>
              ) : (
                recentPurchases.map((p) => (
                  <tr key={p.id} className="border-b border-console-border last:border-0">
                    <td className="px-4 py-3 tabular-nums text-console-muted">
                      {new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{p.quantity ?? '—'}</td>
                    <td className="px-4 py-3 font-bold tabular-nums text-console-indigo">
                      ETB {Number(p.amount ?? 0).toLocaleString('en-US')}
                    </td>
                    <td className="px-4 py-3"><StatusPill status={p.payment_status} tone={statusTone(p.payment_status)} /></td>
                    <td className="px-4 py-3 text-app-muted">{p.attended ? '✓' : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="px-1 text-xs tabular-nums text-app-muted">
          Showing the latest {recentPurchases.length} purchase{recentPurchases.length === 1 ? '' : 's'}
          {capacity > 0 ? ` · capacity ${capacity}` : ''}
        </p>
      </section>
    </ConsolePageShell>
  )
}
