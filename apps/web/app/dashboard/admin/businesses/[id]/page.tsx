import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BadgeCheck, MapPin, Store, UtensilsCrossed } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  ConsolePageShell,
  ConsoleHeader,
  SectionTitle,
  StatusPill,
} from '@/components/dashboard/console'
import { CONSOLE_SURFACE, statusTone } from '@/components/dashboard/console-shared'
import { CONSOLE_CARD, CONSOLE_SECONDARY_BUTTON } from '@/components/dashboard/console-tokens'
import { AdminBackLink } from '@/components/dashboard/admin-back-link'
import { AdminKpiCard } from '@/components/dashboard/admin-kpi-card'
import { BusinessSuspendAction } from '@/components/dashboard/admin-actions'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Business detail · Admin' }

export default async function AdminBusinessDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  const { data: business } = await supabase
    .from('businesses')
    .select(
      `id, name, email, phone, city, country, address, category, plan, status,
       is_verified, website, description, created_at, owner_id`
    )
    .eq('id', params.id)
    .maybeSingle()

  if (!business) notFound()

  const b = business as unknown as {
    id: string
    name: string
    email: string | null
    phone: string | null
    city: string | null
    country: string | null
    address: string | null
    category: string | null
    plan: string | null
    status: string
    is_verified: boolean | null
    website: string | null
    description: string | null
    created_at: string | null
    owner_id: string | null
  }

  const { data: branchRows } = await supabase
    .from('branches')
    .select('id, branch_name, address')
    .eq('business_id', b.id)
    .limit(100)
  const branches = (branchRows ?? []) as Array<{ id: string; branch_name: string; address: string | null }>
  const branchIds = branches.map((x) => x.id)

  const [restaurantsRes, menuCountRes] = await Promise.all([
    supabase
      .from('restaurants')
      .select('id, name, cuisine, area_label, rating, is_active')
      .eq('business_id', b.id)
      .limit(100),
    branchIds.length
      ? supabase.from('menu_items').select('id', { count: 'exact', head: true }).in('branch_id', branchIds)
      : Promise.resolve({ count: 0 }),
  ])

  const restaurants = (restaurantsRes.data ?? []) as Array<{
    id: string
    name: string
    cuisine: string | null
    area_label: string | null
    rating: number | null
    is_active: boolean | null
  }>

  const kpis = [
    { label: 'Listings', value: String(restaurants.length), icon: Store, tone: 'indigo' as const },
    { label: 'Branches', value: String(branches.length), icon: MapPin, tone: 'sky' as const },
    { label: 'Menu items', value: String(menuCountRes.count ?? 0), icon: UtensilsCrossed, tone: 'mint' as const },
  ]

  return (
    <ConsolePageShell>
      <AdminBackLink href="/dashboard/admin/businesses">Back to businesses</AdminBackLink>

      <ConsoleHeader
        eyebrow="Partner console · admin view"
        title={b.name}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {(b.status === 'pending' || b.status === 'rejected') && (
              <Link href="/dashboard/admin/verification" className={CONSOLE_SECONDARY_BUTTON}>
                Review in Verification
              </Link>
            )}
            <BusinessSuspendAction businessId={b.id} status={b.status} />
          </div>
        }
      />

      <section
        className={cn(
          CONSOLE_CARD,
          'flex flex-wrap items-center gap-3 p-4 text-sm',
          b.status === 'pending' && 'border-console-indigo/25 bg-console-indigo-soft/50',
        )}
      >
        <StatusPill status={b.status} tone={statusTone(b.status)} />
        {b.is_verified && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/15 px-2.5 py-1 text-[11px] font-bold text-success">
            <BadgeCheck aria-hidden="true" className="size-3.5" strokeWidth={2.3} />
            Verified
          </span>
        )}
        <span className="capitalize text-console-muted">Plan: {b.plan ?? 'free'}</span>
        {b.category && <span className="capitalize text-console-muted">{b.category}</span>}
      </section>

      {/* Contact + meta */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className={cn(CONSOLE_CARD, 'space-y-2 p-5 text-sm')}>
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-console-muted">
            Contact
          </h2>
          <p>{b.email ?? 'No email on file'}</p>
          {b.phone && <p className="tabular-nums text-app-muted">{b.phone}</p>}
          {(b.address || b.city || b.country) && (
            <p className="truncate text-app-muted">
              {[b.address, b.city, b.country].filter(Boolean).join(', ')}
            </p>
          )}
          {b.website && (
            <a
              href={b.website}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-app-muted underline underline-offset-2 hover:text-ember"
            >
              {b.website}
            </a>
          )}
        </div>
        <div className={cn(CONSOLE_CARD, 'space-y-2 p-5 text-sm')}>
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-console-muted">
            About
          </h2>
          <p className="leading-relaxed text-console-muted">
            {b.description ?? 'No editorial description provided yet.'}
          </p>
          {b.created_at && (
            <p className="pt-1 text-xs tabular-nums text-app-muted">
              Partner since{' '}
              {new Date(b.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <AdminKpiCard key={kpi.label} label={kpi.label} value={kpi.value} icon={kpi.icon} tone={kpi.tone} />
        ))}
      </section>

      {/* Listings */}
      <section className="space-y-3">
        <SectionTitle>Listings</SectionTitle>
        <p className="text-xs text-app-muted">Showing up to 100 listings.</p>
        {restaurants.length === 0 ? (
          <div className={cn(CONSOLE_SURFACE, 'border-dashed p-8 text-center')}>
            <p className="text-sm text-app-muted">This partner has no published listings yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {restaurants.map((r) => (
              <div key={r.id} className={cn(CONSOLE_CARD, 'flex items-center justify-between p-4')}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  <p className="text-xs capitalize text-app-muted">
                    {[r.cuisine, r.area_label].filter(Boolean).join(' · ') || 'Restaurant'}
                    {r.rating != null ? ` · ★ ${String(r.rating)}` : ''}
                  </p>
                </div>
                <StatusPill
                  status={(r.is_active ?? false) ? 'active' : 'inactive'}
                  tone={(r.is_active ?? false) ? 'ok' : 'info'}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Branches */}
      <section className="space-y-3">
        <SectionTitle>Branches</SectionTitle>
        <p className="text-xs text-app-muted">Showing up to 100 branches.</p>
        {branches.length === 0 ? (
          <div className={cn(CONSOLE_SURFACE, 'border-dashed p-8 text-center')}>
            <p className="text-sm text-app-muted">No branches created yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {branches.map((br) => (
              <div key={br.id} className={cn(CONSOLE_CARD, 'flex items-center justify-between p-4')}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{br.branch_name}</p>
                  <p className="truncate text-xs text-console-muted">{br.address ?? '—'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </ConsolePageShell>
  )
}
