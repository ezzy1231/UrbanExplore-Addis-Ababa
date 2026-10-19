import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { ConsolePageShell, ConsoleHeader, FilterChip, StatusPill } from '@/components/dashboard/console'
import { statusTone } from '@/components/dashboard/console-shared'
import { AdminSearchBar } from '@/components/dashboard/admin-search'
import { AdminTable } from '@/components/dashboard/admin-table'
import { ReservationCancelAction } from '@/components/dashboard/admin-actions'

export const metadata: Metadata = { title: 'Reservations · Admin' }
const STATUS_FILTERS = ['all', 'pending', 'confirmed', 'completed', 'cancelled', 'rejected'] as const

export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams?: { status?: string; q?: string; sort?: string; direction?: string; page?: string }
}) {
  const q = (searchParams?.q ?? '').trim()
  const statusFilter = STATUS_FILTERS.includes(searchParams?.status as (typeof STATUS_FILTERS)[number]) ? searchParams?.status ?? 'all' : 'all'
  const allowedSorts = ['reservation_date', 'status', 'guest_count'] as const
  const sort = allowedSorts.includes(searchParams?.sort as (typeof allowedSorts)[number]) ? searchParams?.sort as (typeof allowedSorts)[number] : 'reservation_date'
  const direction = searchParams?.direction === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1)
  const supabase = await createClient()
  let query = supabase.from('reservations')
    .select('id, status, reservation_date, time_slot, guest_count, user_id, branches(branch_name, businesses(name))', { count: 'exact' })
    .order(sort, { ascending: direction === 'asc' })
    .range((page - 1) * 50, page * 50 - 1)
  if (statusFilter !== 'all') query = query.eq('status', statusFilter)
  const { data, error, count } = await query
  if (error) throw new Error('Could not load admin reservations')
  const rows = (data ?? []) as unknown as Array<{ id: string; status: string; reservation_date: string; time_slot: string | null; guest_count: number | null; user_id: string | null; branches: { branch_name: string | null; businesses: { name: string }[] | { name: string } | null }[] | null }>

  // Guest contact details are fetched only for the current result window.
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id))))
  const contactsRes = userIds.length ? await supabase.rpc('partner_customer_contacts', { p_user_ids: userIds }) : { data: [] }
  if ('error' in contactsRes && contactsRes.error) throw new Error('Could not load reservation contacts')
  const profilesRes = userIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
    : { data: [] }
  if ('error' in profilesRes && profilesRes.error) throw new Error('Could not load reservation guests')
  const contacts = new Map(((contactsRes.data ?? []) as Array<{ id: string; email: string | null; phone: string | null }>).map((contact) => [contact.id, { email: contact.email, phone: contact.phone, name: null as string | null }]))
  for (const profile of (profilesRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
    contacts.set(profile.id, { email: profile.email, name: profile.full_name, phone: contacts.get(profile.id)?.phone ?? null })
  }
  const guestLabel = (id: string | null) => {
    const contact = contacts.get(id ?? '')
    return contact?.name || contact?.email || contact?.phone || 'Guest'
  }
  const visibleRows = q ? rows.filter((row) => `${guestLabel(row.user_id)} ${contacts.get(row.user_id ?? '')?.email ?? ''}`.toLowerCase().includes(q.toLowerCase())) : rows

  return (
    <ConsolePageShell maxWidth="max-w-7xl">
      <ConsoleHeader eyebrow="Admin console" title="Reservations" subtitle="Platform-wide booking oversight. Cancelling is audited." />
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => <FilterChip key={status} href={`/dashboard/admin/reservations?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ''}`} active={statusFilter === status}>{status}</FilterChip>)}
        </div>
        <AdminSearchBar
          id="reservation-search"
          label="Search guest email or phone"
          placeholder="Search guest email or phone…"
          defaultValue={q}
          hiddenFields={{ status: statusFilter === 'all' ? undefined : statusFilter }}
        />
      </div>
      <AdminTable
        caption="Reservations"
        basePath="/dashboard/admin/reservations"
        query={{ q, status: statusFilter === 'all' ? undefined : statusFilter, sort, direction }}
        sort={sort}
        direction={direction}
        page={page}
        total={count ?? 0}
        error={Boolean(error)}
        emptyText={q ? 'No reservations match this guest contact.' : 'No reservations match this filter.'}
        columns={[{ key: 'guest', label: 'Guest' }, { key: 'venue', label: 'Venue' }, { key: 'reservation_date', label: 'When', sortable: true }, { key: 'guest_count', label: 'Party', sortable: true }, { key: 'status', label: 'Status', sortable: true }, { key: 'actions', label: 'Actions', align: 'right' }]}
        rows={visibleRows.map((row) => {
          const branch = row.branches?.[0] ?? null
          const business = branch?.businesses ? Array.isArray(branch.businesses) ? branch.businesses[0]?.name ?? '' : branch.businesses.name : ''
          return { key: row.id, cells: [
            <Link key="guest" href={`/dashboard/admin/reservations/${row.id}`} className="font-semibold underline-offset-2 hover:underline">{guestLabel(row.user_id)}</Link>,
            <span key="venue" className="text-app-muted">{[business, branch?.branch_name].filter(Boolean).join(' · ') || '—'}</span>,
            <span key="when" className="whitespace-nowrap tabular-nums text-app-muted">{new Date(`${row.reservation_date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}{row.time_slot ? ` · ${row.time_slot}` : ''}</span>,
            <span key="party" className="tabular-nums">{row.guest_count ?? '—'}</span>,
            <StatusPill key="status" status={row.status} tone={statusTone(row.status)} />,
            <ReservationCancelAction key="actions" reservationId={row.id} status={row.status} />,
          ] }
        })}
      />
      <p className="text-xs text-app-muted">Guest search checks contact details in the current page of 50 reservations.</p>
    </ConsolePageShell>
  )
}
