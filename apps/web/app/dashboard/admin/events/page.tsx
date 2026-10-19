import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { ConsolePageShell, ConsoleHeader, FilterChip, StatusPill } from '@/components/dashboard/console'
import { statusTone } from '@/components/dashboard/console-shared'
import { AdminSearchBar } from '@/components/dashboard/admin-search'
import { AdminTable } from '@/components/dashboard/admin-table'
import { EventModerationActions } from '@/components/dashboard/admin-actions'

export const metadata: Metadata = { title: 'Events · Admin' }
const STATUS_FILTERS = ['all', 'published', 'draft', 'cancelled', 'completed'] as const

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string; sort?: string; direction?: string; page?: string }
}) {
  const q = (searchParams?.q ?? '').trim()
  const statusFilter = STATUS_FILTERS.includes(searchParams?.status as (typeof STATUS_FILTERS)[number]) ? searchParams?.status ?? 'all' : 'all'
  const allowedSorts = ['title', 'starts_at', 'status'] as const
  const sort = allowedSorts.includes(searchParams?.sort as (typeof allowedSorts)[number]) ? searchParams?.sort as (typeof allowedSorts)[number] : 'starts_at'
  const direction = searchParams?.direction === 'desc' ? 'desc' : 'asc'
  const page = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1)

  const supabase = await createClient()
  let query = supabase
    .from('events')
    .select('id, title, status, is_active, starts_at, organizers(name)', { count: 'exact' })
    .order(sort, { ascending: direction === 'asc', nullsFirst: false })
    .range((page - 1) * 50, page * 50 - 1)
  if (statusFilter !== 'all') query = query.eq('status', statusFilter)
  if (q) query = query.ilike('title', `%${q}%`)
  const { data, error, count } = await query
  const rows = (data ?? []) as Array<{ id: string; title: string; status: string; is_active: boolean | null; starts_at: string | null; organizers: { name: string }[] | { name: string } | null }>

  return (
    <ConsolePageShell maxWidth="max-w-7xl">
      <ConsoleHeader eyebrow="Admin console" title="Events" subtitle="Moderate what appears on the public events catalogue." />
      <div className="space-y-3">
        <AdminSearchBar
          id="event-search"
          label="Search events"
          placeholder="Search events…"
          defaultValue={q}
          hiddenFields={{ status: statusFilter === 'all' ? undefined : statusFilter }}
        />
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => <FilterChip key={status} href={`/dashboard/admin/events?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ''}`} active={statusFilter === status}>{status}</FilterChip>)}
        </div>
      </div>
      <AdminTable
        caption="Events"
        basePath="/dashboard/admin/events"
        query={{ q, status: statusFilter === 'all' ? undefined : statusFilter, sort, direction }}
        sort={sort}
        direction={direction}
        page={page}
        total={count ?? 0}
        error={Boolean(error)}
        emptyText="No events match this filter."
        columns={[{ key: 'title', label: 'Event', sortable: true }, { key: 'organizer', label: 'Organizer' }, { key: 'starts_at', label: 'Date', sortable: true }, { key: 'status', label: 'Status', sortable: true }, { key: 'actions', label: 'Moderate', align: 'right' }]}
        rows={rows.map((row) => {
          const organizerName = Array.isArray(row.organizers) ? row.organizers[0]?.name ?? '—' : row.organizers?.name ?? '—'
          return { key: row.id, cells: [
            <Link key="event" href={`/dashboard/admin/events/${row.id}`} className="font-semibold underline-offset-2 hover:underline">{row.title}</Link>,
            <span key="organizer" className="text-app-muted">{organizerName}</span>,
            <span key="date" className="whitespace-nowrap tabular-nums text-app-muted">{formatDate(row.starts_at)}</span>,
            <StatusPill key="status" status={row.status} tone={statusTone(row.status)} />,
            <EventModerationActions key="actions" eventId={row.id} status={row.status} />,
          ] }
        })}
      />
      <p className="text-xs text-app-muted">Showing 50 events per page.</p>
    </ConsolePageShell>
  )
}
