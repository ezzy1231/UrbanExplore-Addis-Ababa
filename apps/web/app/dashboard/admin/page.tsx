import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowUpRight,
  Building2,
  CalendarX2,
  CircleCheck,
  Inbox,
  Search,
  ShieldCheck,
  Store,
  UserRoundCheck,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  ConsolePageShell,
  ConsoleHeader,
  ConsoleRangeLinks,
  SectionTitle,
  StatusPill,
} from '@/components/dashboard/console'
import { CONSOLE_SURFACE, statusTone } from '@/components/dashboard/console-shared'
import { CONSOLE_CARD } from '@/components/dashboard/console-tokens'
import { AdminKpiCard } from '@/components/dashboard/admin-kpi-card'
import {
  RANGE_DAYS,
  bucketSeries,
  parseRange,
  periodDelta,
  startOfUtcDay,
} from '@/components/dashboard/admin-period'
import { ConsoleChartCard } from '@/components/dashboard/console-chart'
import { AdminActivityFeed, type AdminActivityItem } from '@/components/dashboard/admin-activity-feed'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Admin Console' }

type CreatedRow = { created_at: string }
type DirectoryRow = { id: string; name: string; role: string; status: string }
type PendingBusiness = { id: string; name: string; created_at: string | null }

function splitByWindow(rows: CreatedRow[], currentStartIso: string) {
  const current = rows.filter((row) => row.created_at >= currentStartIso)
  return { current, previous: rows.length - current.length }
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'recently'
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`
  if (minutes < 60 * 24 * 7) return `${Math.round(minutes / 1440)}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: { q?: string; range?: string }
}) {
  const q = (searchParams?.q ?? '').trim()
  const range = parseRange(searchParams?.range)
  const days = RANGE_DAYS[range]

  const supabase = await createClient()
  const currentStartIso = startOfUtcDay(days - 1)
  const previousStartIso = startOfUtcDay(days * 2 - 1)

  const [
    usersTotalRes,
    businessesTotalRes,
    organizersTotalRes,
    listingsTotalRes,
    usersRowsRes,
    businessesRowsRes,
    organizersRowsRes,
    listingsRowsRes,
    verificationOpenRes,
    cancelledEventsRes,
    suspendedUsersRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('businesses').select('id', { count: 'exact', head: true }),
    supabase.from('organizers').select('id', { count: 'exact', head: true }),
    supabase.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('profiles').select('created_at').gte('created_at', previousStartIso).order('created_at', { ascending: true }).limit(5000),
    supabase.from('businesses').select('created_at').gte('created_at', previousStartIso).order('created_at', { ascending: true }).limit(5000),
    supabase.from('organizers').select('created_at').gte('created_at', previousStartIso).order('created_at', { ascending: true }).limit(5000),
    supabase.from('restaurants').select('created_at').eq('is_active', true).gte('created_at', previousStartIso).order('created_at', { ascending: true }).limit(5000),
    supabase.from('verification_requests').select('id', { count: 'exact', head: true }).in('status', ['pending', 'in_review', 'needs_info']),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_suspended', true),
  ])

  let pendingQuery = supabase
    .from('businesses')
    .select('id, name, created_at', { count: 'exact' })
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(5)
  if (q) pendingQuery = pendingQuery.ilike('name', `%${q}%`)

  let businessDirQuery = supabase
    .from('businesses')
    .select('id, name, status')
    .order('created_at', { ascending: false })
    .limit(6)
  let organizerDirQuery = supabase
    .from('organizers')
    .select('id, name, status')
    .order('created_at', { ascending: false })
    .limit(4)
  if (q) {
    businessDirQuery = businessDirQuery.ilike('name', `%${q}%`)
    organizerDirQuery = organizerDirQuery.ilike('name', `%${q}%`)
  }

  const [pendingRes, bizDirRes, orgDirRes, auditRes] = await Promise.all([
    pendingQuery,
    businessDirQuery,
    organizerDirQuery,
    supabase
      .from('audit_logs')
      .select('id, actor_id, action, entity_type, entity_id, created_at')
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  const auditRows = (auditRes.data ?? []) as Array<{
    id: string
    actor_id: string | null
    action: string
    entity_type: string | null
    entity_id: string | null
    created_at: string
  }>
  const actorIds = Array.from(new Set(auditRows.map((row) => row.actor_id).filter((id): id is string => Boolean(id))))
  const actorsRes = actorIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', actorIds)
    : { data: [] }
  const actorNames = new Map(
    ((actorsRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map(
      (actor) => [actor.id, actor.full_name || actor.email || 'system'],
    ),
  )

  const resourceRows = [
    { key: 'users', rows: (usersRowsRes.data ?? []) as CreatedRow[] },
    { key: 'businesses', rows: (businessesRowsRes.data ?? []) as CreatedRow[] },
    { key: 'organizers', rows: (organizersRowsRes.data ?? []) as CreatedRow[] },
    { key: 'listings', rows: (listingsRowsRes.data ?? []) as CreatedRow[] },
  ].map((entry) => {
    const { current, previous } = splitByWindow(entry.rows, currentStartIso)
    const points = bucketSeries(
      days,
      current.map((row) => ({ day: row.created_at.slice(0, 10), value: 1 })),
    )
    return {
      key: entry.key,
      current: current.length,
      previous,
      series: points.map((point) => point.value),
      points,
    }
  })
  const resource = (key: string) => resourceRows.find((entry) => entry.key === key) ?? { current: 0, previous: 0, series: [], points: [] }

  const users = resource('users')
  const businesses = resource('businesses')
  const organizers = resource('organizers')
  const listings = resource('listings')

  const kpis = [
    { label: 'Total users', value: usersTotalRes.count ?? 0, icon: Users, tone: 'indigo' as const, href: '/dashboard/admin/users', ...users },
    { label: 'Businesses', value: businessesTotalRes.count ?? 0, icon: Building2, tone: 'sand' as const, href: '/dashboard/admin/businesses', ...businesses },
    { label: 'Organizers', value: organizersTotalRes.count ?? 0, icon: UserRoundCheck, tone: 'sky' as const, href: '/dashboard/admin/organizers', ...organizers },
    { label: 'Active listings', value: listingsTotalRes.count ?? 0, icon: Store, tone: 'mint' as const, href: '/dashboard/admin/businesses', ...listings },
  ]

  const pendingRows = (pendingRes.data ?? []) as PendingBusiness[]
  const directory: DirectoryRow[] = [
    ...((bizDirRes.data ?? []) as Array<{ id: string; name: string; status: string }>).map((row) => ({ ...row, role: 'Business' })),
    ...((orgDirRes.data ?? []) as Array<{ id: string; name: string; status: string }>).map((row) => ({ ...row, role: 'Organizer' })),
  ]

  const openVerification = verificationOpenRes.count ?? 0
  const pendingCount = pendingRes.count ?? 0
  const cancelledEvents = cancelledEventsRes.count ?? 0
  const suspendedUsers = suspendedUsersRes.count ?? 0
  const attentionTotal = openVerification + pendingCount + cancelledEvents + suspendedUsers

  const attentionItems = [
    {
      key: 'verification',
      label: 'Verification requests',
      hint: 'Partners waiting on a decision',
      value: openVerification,
      href: '/dashboard/admin/verification',
      icon: ShieldCheck,
      tone: 'bg-console-sand text-console-sand-ink',
    },
    {
      key: 'businesses',
      label: 'Businesses pending',
      hint: 'Submitted, not yet approved',
      value: pendingCount,
      href: '/dashboard/admin/businesses?status=pending',
      icon: Building2,
      tone: 'bg-console-sky text-console-sky-ink',
    },
    {
      key: 'events',
      label: 'Cancelled events',
      hint: 'Hidden from the public catalogue',
      value: cancelledEvents,
      href: '/dashboard/admin/events?status=cancelled',
      icon: CalendarX2,
      tone: 'bg-console-blush text-console-blush-ink',
    },
    {
      key: 'users',
      label: 'Suspended users',
      hint: 'Access currently blocked',
      value: suspendedUsers,
      href: '/dashboard/admin/users',
      icon: Users,
      tone: 'bg-danger/12 text-danger',
    },
  ]

  const activityItems: AdminActivityItem[] = auditRows.map((row) => ({
    id: row.id,
    action: row.action,
    actor: actorNames.get(row.actor_id ?? '') ?? 'system',
    entityType: row.entity_type,
    entityId: row.entity_id,
    createdAt: row.created_at,
  }))

  return (
    <ConsolePageShell maxWidth="max-w-7xl">
      <ConsoleHeader
        eyebrow="Operations"
        title="Overview"
        subtitle={`Platform activity and items requiring attention over the last ${days} days.`}
        action={<ConsoleRangeLinks current={range} />}
      />

      <section aria-label="Platform totals" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <AdminKpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            tone={kpi.tone}
            href={kpi.href}
            sparkline={kpi.series}
            delta={periodDelta(kpi.current, kpi.previous, days)}
          />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <ConsoleChartCard
          className="xl:col-span-2"
          title="New accounts"
          subtitle={`Daily additions over the last ${days} days`}
          unit="new"
          kind="area"
          series={{
            Users: { points: users.points },
            Businesses: { points: businesses.points },
            Organizers: { points: organizers.points },
            Listings: { points: listings.points },
          }}
        />

        <section className={cn(CONSOLE_CARD, 'flex flex-col overflow-hidden')}>
          <div className="flex items-center justify-between gap-3 border-b border-console-border px-5 py-4">
            <div>
              <h2 className="text-[15px] font-bold text-console-ink">Needs attention</h2>
              <p className="mt-0.5 text-xs text-console-muted">Live platform exceptions</p>
            </div>
            {attentionTotal > 0 ? (
              <span className="rounded-full bg-console-sand px-2.5 py-1 text-[11px] font-bold tabular-nums text-console-sand-ink">
                {attentionTotal}
              </span>
            ) : (
              <CircleCheck className="size-5 text-success" strokeWidth={2.1} aria-label="No open exceptions" />
            )}
          </div>

          <ul className="flex-1 divide-y divide-console-border">
            {attentionItems.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-console-bg/60"
                >
                  <span
                    aria-hidden="true"
                    className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', item.tone)}
                  >
                    <item.icon className="size-[18px]" strokeWidth={2.1} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-console-ink">{item.label}</span>
                    <span className="block truncate text-[11px] text-console-muted">{item.hint}</span>
                  </span>
                  <span className="text-lg font-bold tabular-nums text-console-ink">{item.value}</span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-console-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-console-indigo"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle>Pending verification</SectionTitle>
            <span className="text-xs font-semibold tabular-nums text-console-muted">
              {pendingCount} awaiting review
            </span>
          </div>

          {pendingRes.error ? (
            <div role="alert" className={cn(CONSOLE_SURFACE, 'p-4 text-sm text-danger')}>
              Could not load verification requests.{' '}
              <Link href="/dashboard/admin" className="underline">
                Retry
              </Link>
            </div>
          ) : pendingRows.length > 0 ? (
            <div className={cn(CONSOLE_SURFACE, 'divide-y divide-console-border overflow-hidden')}>
              {pendingRows.map((row) => (
                <div key={row.id} className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-console-ink">{row.name}</p>
                    <p className="text-xs text-console-muted">Submitted {relativeTime(row.created_at)}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-console-sand px-2.5 py-1 text-[11px] font-bold text-console-sand-ink">
                    Awaiting decision
                  </span>
                </div>
              ))}
              <Link
                href="/dashboard/admin/verification"
                className="flex min-h-11 items-center justify-center gap-1 text-sm font-semibold text-console-indigo transition-colors hover:bg-console-bg/60"
              >
                Review in Verification
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className={cn(CONSOLE_SURFACE, 'flex flex-col items-center justify-center px-6 py-12 text-center')}>
              <span className="flex size-10 items-center justify-center rounded-full bg-console-bg text-console-muted">
                <Inbox className="size-5" strokeWidth={1.9} aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold text-console-ink">Queue is clear</p>
              <p className="mt-1 text-xs text-console-muted">No business is waiting for verification.</p>
            </div>
          )}
        </div>

        <AdminActivityFeed items={activityItems} href="/dashboard/admin/audit" />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Directory</SectionTitle>
          <div className="flex gap-3 text-xs font-semibold text-console-indigo">
            <Link href="/dashboard/admin/businesses" className="hover:underline">All businesses</Link>
            <Link href="/dashboard/admin/organizers" className="hover:underline">All organizers</Link>
          </div>
        </div>

        <form method="get" className={cn(CONSOLE_SURFACE, 'flex items-center gap-3 px-3 py-2')}>
          {range !== '30d' && <input type="hidden" name="range" value={range} />}
          <Search aria-hidden="true" className="size-4 shrink-0 text-console-muted" strokeWidth={2.1} />
          <label htmlFor="directory-search" className="sr-only">Search entities</label>
          <input
            id="directory-search"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search businesses and organizers…"
            className="min-h-10 w-full bg-transparent text-sm text-console-ink outline-none placeholder:text-console-muted"
          />
          <button className="min-h-10 shrink-0 rounded-lg bg-console-indigo px-4 text-xs font-semibold text-white transition-colors hover:bg-console-indigo-deep">
            Search
          </button>
        </form>

        {bizDirRes.error || orgDirRes.error ? (
          <div role="alert" className={cn(CONSOLE_SURFACE, 'p-4 text-sm text-danger')}>
            Could not load the directory.{' '}
            <Link href="/dashboard/admin" className="underline">
              Retry
            </Link>
          </div>
        ) : (
          <div className={cn(CONSOLE_SURFACE, 'overflow-hidden')}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Recent businesses and organizers</caption>
                <thead>
                  <tr className="border-b border-console-border bg-console-bg/60 text-[10px] uppercase tracking-[0.12em] text-console-muted">
                    <th scope="col" className="px-4 py-3 font-bold">Name</th>
                    <th scope="col" className="px-4 py-3 font-bold">Type</th>
                    <th scope="col" className="px-4 py-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {directory.length ? (
                    directory.map((row) => (
                      <tr key={`${row.role}-${row.id}`} className="border-b border-console-border last:border-0 transition-colors hover:bg-console-bg/60">
                        <td className="max-w-[360px] truncate px-4 py-2.5 font-semibold text-console-ink">{row.name}</td>
                        <td className="px-4 py-2.5 text-console-muted">{row.role}</td>
                        <td className="px-4 py-2.5">
                          <StatusPill status={row.status} tone={statusTone(row.status)} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-sm text-console-muted">
                        {q ? `No entities match “${q}”.` : 'No partners yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </ConsolePageShell>
  )
}
