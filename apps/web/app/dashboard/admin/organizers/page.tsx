import Link from 'next/link'
import type { Metadata } from 'next'
import { BadgeCheck, Minus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  ConsolePageShell,
  ConsoleHeader,
  FilterChip,
  StatusPill,
} from '@/components/dashboard/console'
import { statusTone } from '@/components/dashboard/console-shared'
import { AdminSearchBar } from '@/components/dashboard/admin-search'
import { AdminTable } from '@/components/dashboard/admin-table'

export const metadata: Metadata = { title: 'Organizers · Admin' }

const STATUS_FILTERS = ['all', 'pending', 'active', 'rejected', 'inactive'] as const

export default async function AdminOrganizersPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string; sort?: string; direction?: string; page?: string }
}) {
  const q = (searchParams?.q ?? '').trim()
  const statusFilter =
    searchParams?.status &&
    STATUS_FILTERS.includes(searchParams.status as (typeof STATUS_FILTERS)[number])
      ? searchParams.status
      : 'all'
  const allowedSorts = ['name', 'email', 'status', 'created_at'] as const
  const sort = allowedSorts.includes(searchParams?.sort as (typeof allowedSorts)[number]) ? searchParams?.sort as (typeof allowedSorts)[number] : 'created_at'
  const direction = searchParams?.direction === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1)

  const supabase = await createClient()
  let query = supabase
    .from('organizers')
    .select('id, name, email, status, is_verified, created_at', { count: 'exact' })
    .order(sort, { ascending: direction === 'asc' })
    .range((page - 1) * 50, page * 50 - 1)
  if (statusFilter !== 'all') query = query.eq('status', statusFilter)
  if (q) query = query.ilike('name', `%${q}%`)

  const { data, error, count } = await query
  const rows = (data ?? []) as Array<{
    id: string
    name: string
    email: string | null
    status: string
    is_verified: boolean | null
    created_at: string
  }>

  const pendingCount = rows.filter((r) => r.status === 'pending').length

  return (
    <ConsolePageShell>
      <ConsoleHeader
        eyebrow="Admin console"
        title="Organizers"
        subtitle="Event organizer directory. Verification decisions happen in the Verification queue."
      />

      <div className="flex flex-col gap-3">
        <AdminSearchBar
          id="organizer-search"
          label="Search organizers"
          placeholder="Search organizers…"
          defaultValue={q}
          hiddenFields={{ status: statusFilter === 'all' ? undefined : statusFilter }}
        />
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <FilterChip
              key={s}
              href={`/dashboard/admin/organizers?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              active={statusFilter === s}
            >
              {s}
            </FilterChip>
          ))}
        </div>
      </div>

      <section className="space-y-3">
        {pendingCount > 0 && (
          <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-console-sand px-3 py-1.5 text-[11px] font-bold text-console-sand-ink">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-60" />
            {pendingCount} pending in view
          </span>
        )}

        <AdminTable
          caption="Organizers"
          basePath="/dashboard/admin/organizers"
          query={{ q, status: statusFilter === 'all' ? undefined : statusFilter, sort, direction }}
          sort={sort}
          direction={direction}
          page={page}
          total={count ?? 0}
          error={Boolean(error)}
          emptyText="No organizers match this filter."
          columns={[{ key: 'name', label: 'Organizer', sortable: true }, { key: 'email', label: 'Email', sortable: true }, { key: 'status', label: 'Status', sortable: true }, { key: 'verified', label: 'Verified' }, { key: 'created_at', label: 'Joined', sortable: true }]}
          rows={rows.map((row) => ({ key: row.id, cells: [
            <Link key="organizer" href={`/dashboard/admin/organizers/${row.id}`} className="font-semibold underline-offset-2 hover:underline">{row.name}</Link>,
            <span key="email" className="text-app-muted">{row.email ?? 'No public email'}</span>,
            <StatusPill key="status" status={row.status} tone={statusTone(row.status)} />,
            <span
              key="verified"
              role="img"
              aria-label={row.is_verified ? 'Verified' : 'Not verified'}
              className="inline-flex items-center"
            >
              {row.is_verified ? (
                <BadgeCheck aria-hidden="true" className="size-4 text-success" strokeWidth={2.2} />
              ) : (
                <Minus aria-hidden="true" className="size-4 text-console-muted/60" strokeWidth={2.4} />
              )}
            </span>,
            <span key="joined" className="whitespace-nowrap tabular-nums text-app-muted">{new Date(row.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>,
          ] }))}
        />
      </section>
    </ConsolePageShell>
  )
}
