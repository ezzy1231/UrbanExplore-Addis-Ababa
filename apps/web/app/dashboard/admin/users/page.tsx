import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConsolePageShell, ConsoleHeader, FilterChip, StatusPill } from '@/components/dashboard/console'
import { statusTone } from '@/components/dashboard/console-shared'
import { AdminTable } from '@/components/dashboard/admin-table'
import { AdminSearchBar } from '@/components/dashboard/admin-search'
import { UserRoleSelect, UserSuspensionActions } from '@/components/dashboard/admin-actions'

export const metadata: Metadata = { title: 'Users · Admin' }

const ROLE_FILTERS = ['all', 'customer', 'food_business', 'event_organizer', 'system_admin'] as const

const ROLE_LABEL: Record<(typeof ROLE_FILTERS)[number], string> = {
  all: 'All roles',
  customer: 'Customers',
  food_business: 'Businesses',
  event_organizer: 'Organizers',
  system_admin: 'Admins',
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: { q?: string; role?: string; sort?: string; direction?: string; page?: string }
}) {
  const q = (searchParams?.q ?? '').trim()
  const roleFilter = ROLE_FILTERS.includes(searchParams?.role as (typeof ROLE_FILTERS)[number]) ? searchParams?.role ?? 'all' : 'all'
  const allowedSorts = ['full_name', 'email', 'role', 'created_at'] as const
  const sort = allowedSorts.includes(searchParams?.sort as (typeof allowedSorts)[number]) ? searchParams?.sort as (typeof allowedSorts)[number] : 'created_at'
  const direction = searchParams?.direction === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  let query = supabase
    .from('profiles')
    .select('id, full_name, email, role, is_suspended, created_at', { count: 'exact' })
    .order(sort, { ascending: direction === 'asc', nullsFirst: false })
    .range((page - 1) * 50, page * 50 - 1)
  if (roleFilter !== 'all') query = query.eq('role', roleFilter)
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
  const { data, error, count } = await query
  const rows = (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null; role: string; is_suspended: boolean | null; created_at: string }>

  return (
    <ConsolePageShell maxWidth="max-w-7xl">
      <ConsoleHeader eyebrow="Admin console" title="Users" subtitle="Roles, suspension, and account search. Role changes are recorded in the audit log." />
      <div className="space-y-3">
        <AdminSearchBar
          id="user-search"
          label="Search by name or email"
          placeholder="Search by name or email…"
          defaultValue={q}
          hiddenFields={{ role: roleFilter === 'all' ? undefined : roleFilter }}
        />
        <div className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map((role) => <FilterChip key={role} href={`/dashboard/admin/users?role=${role}${q ? `&q=${encodeURIComponent(q)}` : ''}`} active={roleFilter === role}>{ROLE_LABEL[role]}</FilterChip>)}
        </div>
      </div>
      <AdminTable
        caption="Users"
        basePath="/dashboard/admin/users"
        query={{ q, role: roleFilter === 'all' ? undefined : roleFilter, sort, direction }}
        sort={sort}
        direction={direction}
        page={page}
        total={count ?? 0}
        error={Boolean(error)}
        emptyText="No users match this filter."
        columns={[{ key: 'full_name', label: 'User', sortable: true }, { key: 'email', label: 'Email', sortable: true }, { key: 'role', label: 'Role', sortable: true }, { key: 'status', label: 'Status' }, { key: 'created_at', label: 'Joined', sortable: true }, { key: 'actions', label: 'Actions', align: 'right' }]}
        rows={rows.map((row) => {
          const isSelf = row.id === user.id
          return { key: row.id, cells: [
            <span key="user" className="inline-flex items-center gap-2 font-medium">{row.full_name ?? '—'}{isSelf && <span className="rounded-md bg-console-indigo-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-console-indigo">You</span>}</span>,
            <span key="email" className="text-app-muted">{row.email ?? '—'}</span>,
            isSelf ? <StatusPill key="role" status={row.role} tone={statusTone(row.role)} /> : <UserRoleSelect key="role" userId={row.id} currentRole={row.role} />,
            <StatusPill key="status" status={row.is_suspended ? 'suspended' : 'active'} tone={row.is_suspended ? 'bad' : 'ok'} />,
            <span key="joined" className="whitespace-nowrap tabular-nums text-app-muted">{new Date(row.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>,
            isSelf ? <span key="actions" className="text-app-muted">—</span> : <UserSuspensionActions key="actions" userId={row.id} isSuspended={Boolean(row.is_suspended)} />,
          ] }
        })}
      />
      <p className="text-xs text-app-muted">Showing 50 users per page.</p>
    </ConsolePageShell>
  )
}
