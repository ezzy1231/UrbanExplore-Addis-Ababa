import { redirect } from 'next/navigation'
import { ConsoleShell } from '@/components/dashboard/console-shell'
import { createClient } from '@/lib/supabase/server'
import { getUnreadNotificationCount } from '@/lib/supabase/queries'
import type { ConsoleNavItem } from '@/components/dashboard/console-shell'

const NAV_ITEMS: ConsoleNavItem[] = [
  { label: 'Overview', href: '/dashboard/admin', section: 'Operations' },
  { label: 'Metrics', href: '/dashboard/admin/metrics', section: 'Operations' },
  { label: 'Verification', href: '/dashboard/admin/verification', section: 'Moderation' },
  { label: 'Businesses', href: '/dashboard/admin/businesses', section: 'Moderation' },
  { label: 'Organizers', href: '/dashboard/admin/organizers', section: 'Moderation' },
  { label: 'Events', href: '/dashboard/admin/events', section: 'Moderation' },
  { label: 'Reservations', href: '/dashboard/admin/reservations', section: 'Moderation' },
  { label: 'Users', href: '/dashboard/admin/users', section: 'Access' },
  { label: 'Audit Log', href: '/dashboard/admin/audit', section: 'Access' },
  { label: 'Settings', href: '/dashboard/admin/settings', section: 'Access' },
]

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Keep the layout gate in addition to middleware and per-action authorization.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin?next=/dashboard/admin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if ((profile?.role as string | undefined) !== 'system_admin') redirect('/auth/no-access')

  const [notificationCount, verificationCountRes] = await Promise.all([
    profile?.id ? getUnreadNotificationCount(profile.id) : Promise.resolve(0),
    // Matches the verification queue's "open" scope (lib/dashboard/verification-data.ts).
    supabase
      .from('verification_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'in_review', 'needs_info']),
  ])

  const verificationCount = verificationCountRes.count ?? 0
  const navItems = NAV_ITEMS.map((item) =>
    item.label === 'Verification' ? { ...item, badge: verificationCount } : item,
  )

  return (
    <ConsoleShell
      navItems={navItems}
      account={{ organization: 'UrbanExplore', role: 'System Admin', displayName: profile?.full_name }}
      notificationCount={notificationCount}
      showPromo={false}
      homeHref="/dashboard/admin"
      settingsHref="/dashboard/admin/settings"
      search={{ action: '/dashboard/admin/users', placeholder: 'Search users…' }}
    >
      {children}
    </ConsoleShell>
  )
}
