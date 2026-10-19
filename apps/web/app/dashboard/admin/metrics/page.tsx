import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  Ticket,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  ConsolePageShell,
  ConsoleHeader,
  ConsoleRangeLinks,
} from '@/components/dashboard/console'
import { CONSOLE_SURFACE } from '@/components/dashboard/console-shared'
import {
  AdminKpiCard,
  type AdminKpiDelta,
  type AdminKpiTone,
} from '@/components/dashboard/admin-kpi-card'
import {
  RANGE_DAYS,
  bucketSeries,
  parseRange,
  periodDelta,
  startOfUtcDay,
} from '@/components/dashboard/admin-period'
import { ConsoleChartCard, ConsoleDonutChart } from '@/components/dashboard/console-chart'
import { formatETB } from '@/lib/console-format'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Metrics · Admin' }

const ROLE_LABELS: Record<string, string> = {
  customer: 'Customers',
  food_business: 'Food businesses',
  event_organizer: 'Event organizers',
  system_admin: 'Admins',
}

type PaidPurchase = { quantity: number | null; amount: number | null; created_at: string }

function sumAmount(rows: PaidPurchase[]) {
  return rows.reduce((total, row) => total + (Number(row.amount) || 0), 0)
}

type MetricCard = {
  label: string
  value: string | number
  icon: LucideIcon
  tone: AdminKpiTone
  href?: string
  delta?: AdminKpiDelta
  sparkline?: number[]
}

export default async function AdminMetricsPage({
  searchParams,
}: {
  searchParams?: { range?: string }
}) {
  const range = parseRange(searchParams?.range)
  const days = RANGE_DAYS[range]

  const supabase = await createClient()
  const nowIso = new Date().toISOString()
  const currentStartIso = startOfUtcDay(days - 1)
  const previousStartIso = startOfUtcDay(days * 2 - 1)
  const currentStartDate = currentStartIso.slice(0, 10)
  const previousStartDate = previousStartIso.slice(0, 10)
  const todayDate = nowIso.slice(0, 10)

  const [usersRes, businessesRes, organizersRes, eventsRes, rolesRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('businesses').select('id', { count: 'exact', head: true }),
    supabase.from('organizers').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('profiles').select('role').limit(5000),
  ])

  // Windowed activity for trends + charts. Capped at 5,000 rows per query —
  // plenty at launch scale; move to an aggregate RPC when it isn't.
  const [signupsRes, reservationsRes, purchasesRes] = await Promise.all([
    supabase.from('profiles').select('created_at').gte('created_at', previousStartIso).limit(5000),
    supabase
      .from('reservations')
      .select('reservation_date')
      .gte('reservation_date', previousStartDate)
      .limit(5000),
    supabase
      .from('ticket_purchases')
      .select('quantity, amount, payment_status, created_at')
      .gte('created_at', previousStartIso)
      .eq('payment_status', 'paid')
      .limit(5000),
  ])

  const signups = ((signupsRes.data ?? []) as Array<{ created_at: string }>).filter(
    (row) => row.created_at >= previousStartIso && row.created_at <= nowIso,
  )
  const currentSignups = signups.filter((row) => row.created_at >= currentStartIso)
  const previousSignupCount = signups.length - currentSignups.length

  const reservations = ((reservationsRes.data ?? []) as Array<{ reservation_date: string }>).filter(
    (row) => row.reservation_date >= previousStartDate && row.reservation_date <= todayDate,
  )
  const currentReservations = reservations.filter((row) => row.reservation_date >= currentStartDate)
  const previousReservationCount = reservations.length - currentReservations.length

  const purchases = ((purchasesRes.data ?? []) as PaidPurchase[]).filter(
    (row) => row.created_at >= previousStartIso && row.created_at <= nowIso,
  )
  const currentPurchases = purchases.filter((row) => row.created_at >= currentStartIso)
  const previousPurchases = purchases.filter((row) => row.created_at < currentStartIso)

  const currentRevenue = sumAmount(currentPurchases)
  const previousRevenue = sumAmount(previousPurchases)

  const signupSeries = bucketSeries(
    days,
    currentSignups.map((row) => ({ day: row.created_at.slice(0, 10), value: 1 })),
  )
  const reservationSeries = bucketSeries(
    days,
    currentReservations.map((row) => ({ day: row.reservation_date, value: 1 })),
  )
  const ticketSeries = bucketSeries(
    days,
    currentPurchases.map((row) => ({ day: row.created_at.slice(0, 10), value: Number(row.quantity) || 0 })),
  )
  const revenueSeries = bucketSeries(
    days,
    currentPurchases.map((row) => ({ day: row.created_at.slice(0, 10), value: Number(row.amount) || 0 })),
  )

  const roleCounts = new Map<string, number>()
  for (const row of (rolesRes.data ?? []) as Array<{ role: string | null }>) {
    const role = row.role || 'customer'
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1)
  }
  const roleMix = Object.entries(ROLE_LABELS)
    .map(([role, label]) => ({ label, value: roleCounts.get(role) ?? 0 }))
    .filter((slice) => slice.value > 0)

  const hadError = [
    usersRes,
    businessesRes,
    organizersRes,
    eventsRes,
    rolesRes,
    signupsRes,
    reservationsRes,
    purchasesRes,
  ].some((result) => Boolean(result.error))

  const kpis: MetricCard[] = [
    {
      label: 'Total users',
      value: usersRes.count ?? 0,
      icon: Users,
      tone: 'indigo',
      href: '/dashboard/admin/users',
      delta: periodDelta(currentSignups.length, previousSignupCount, days),
      sparkline: signupSeries.map((point) => point.value),
    },
    {
      label: 'Businesses',
      value: businessesRes.count ?? 0,
      icon: Building2,
      tone: 'sand',
      href: '/dashboard/admin/businesses',
    },
    {
      label: 'Organizers',
      value: organizersRes.count ?? 0,
      icon: UserRoundCheck,
      tone: 'sky',
      href: '/dashboard/admin/organizers',
    },
    {
      label: 'Live events',
      value: eventsRes.count ?? 0,
      icon: CalendarDays,
      tone: 'mint',
      href: '/dashboard/admin/events',
    },
    {
      label: `Reservations · ${days}d`,
      value: currentReservations.length,
      icon: CalendarCheck,
      tone: 'sky',
      href: '/dashboard/admin/reservations',
      delta: periodDelta(currentReservations.length, previousReservationCount, days),
      sparkline: reservationSeries.map((point) => point.value),
    },
    {
      label: `Paid ticket volume · ${days}d`,
      value: formatETB(currentRevenue),
      icon: Ticket,
      tone: 'indigo',
      delta: periodDelta(currentRevenue, previousRevenue, days),
      sparkline: revenueSeries.map((point) => point.value),
    },
  ]

  return (
    <ConsolePageShell maxWidth="max-w-7xl">
      <ConsoleHeader
        eyebrow="Admin console"
        title="Platform metrics"
        subtitle={`Growth and activity across the whole marketplace, last ${days} days.`}
        action={<ConsoleRangeLinks current={range} />}
      />

      {hadError && (
        <div
          role="alert"
          className={cn(
            CONSOLE_SURFACE,
            'flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-danger',
          )}
        >
          <span>Some metrics could not be loaded — the figures below may be incomplete.</span>
          <Link
            href={`/dashboard/admin/metrics?range=${range}`}
            className="font-semibold underline"
          >
            Retry
          </Link>
        </div>
      )}

      <section aria-label="Platform totals" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => (
          <AdminKpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            tone={kpi.tone}
            href={kpi.href}
            delta={kpi.delta}
            sparkline={kpi.sparkline}
          />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <ConsoleChartCard
          className="xl:col-span-2"
          title="Platform activity"
          subtitle={`Daily totals over the last ${days} days`}
          unit="records"
          kind="area"
          series={{
            'New signups': { points: signupSeries, unit: 'users' },
            Reservations: { points: reservationSeries, unit: 'bookings' },
            'Tickets sold': { points: ticketSeries, unit: 'tickets' },
            Revenue: { points: revenueSeries, unit: 'ETB' },
          }}
        />

        <ConsoleDonutChart
          title="Accounts by role"
          subtitle="All profiles, up to 5,000 sampled"
          unit="accounts"
          data={roleMix}
        />
      </section>

      <p className="px-1 text-xs text-console-muted">
        Aggregates are computed from up to 5,000 recent rows per series — swap to an aggregate RPC
        when volumes outgrow this.
      </p>
    </ConsolePageShell>
  )
}
