import type { Metadata } from 'next'
import Link from 'next/link'
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
import { BusinessLifecycleActions, BusinessSuspendAction } from '@/components/dashboard/admin-actions'
import { AdminTable } from '@/components/dashboard/admin-table'

export const metadata: Metadata = { title: 'Businesses · Admin' }

const STATUS_FILTERS = ['all', 'pending', 'active', 'inactive', 'rejected'] as const

export default async function AdminBusinessesPage({
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
  const allowedSorts = ['name', 'plan', 'status', 'created_at'] as const
  const sort = allowedSorts.includes(searchParams?.sort as (typeof allowedSorts)[number]) ? searchParams?.sort as (typeof allowedSorts)[number] : 'created_at'
  const direction = searchParams?.direction === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1)

  const supabase = await createClient()
  let query = supabase
    .from('businesses')
    .select('id, name, email, status, is_verified, plan, created_at', { count: 'exact' })
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
    plan: string | null
    created_at: string
  }>

  return (
    <ConsolePageShell>
      <ConsoleHeader
        eyebrow="Admin console"
        title="Businesses"
        subtitle="Verification, suspension, and drilldown per partner."
      />

      <div className="flex flex-col gap-3">
        <AdminSearchBar
          id="business-search"
          label="Search businesses"
          placeholder="Search businesses…"
          defaultValue={q}
          hiddenFields={{ status: statusFilter === 'all' ? undefined : statusFilter }}
        />
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <FilterChip
              key={s}
              href={`/dashboard/admin/businesses?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              active={statusFilter === s}
            >
              {s}
            </FilterChip>
          ))}
        </div>
      </div>

      <AdminTable
        caption="Businesses"
        basePath="/dashboard/admin/businesses"
        query={{ q, status: statusFilter === 'all' ? undefined : statusFilter, sort, direction }}
        sort={sort}
        direction={direction}
        page={page}
        total={count ?? 0}
        error={Boolean(error)}
        emptyText="No businesses match this filter."
        columns={[{ key: 'name', label: 'Business', sortable: true }, { key: 'plan', label: 'Plan', sortable: true }, { key: 'status', label: 'Status', sortable: true }, { key: 'verified', label: 'Verified' }, { key: 'created_at', label: 'Joined', sortable: true }, { key: 'actions', label: 'Actions', align: 'right' }]}
        rows={rows.map((row) => ({ key: row.id, cells: [
          <Link key="business" href={`/dashboard/admin/businesses/${row.id}`} className="font-semibold underline-offset-2 hover:underline">{row.name}</Link>,
          <span key="plan" className="capitalize text-app-muted">{row.plan ?? 'free'}</span>,
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
          <span key="created_at" className="whitespace-nowrap tabular-nums text-app-muted">{new Date(row.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>,
          <div key="actions" className="flex flex-wrap justify-end gap-2"><BusinessLifecycleActions businessId={row.id} status={row.status} /><BusinessSuspendAction businessId={row.id} status={row.status} /></div>,
        ] }))}
      />
    </ConsolePageShell>
  )
}
