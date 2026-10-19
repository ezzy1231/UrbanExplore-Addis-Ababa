import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConsolePageShell, ConsoleHeader, StatusPill } from '@/components/dashboard/console'
import { CONSOLE_CARD } from '@/components/dashboard/console-tokens'
import { cn } from '@/lib/utils'
import SignOutButton from '@/app/settings/SignOutButton'

export const metadata: Metadata = { title: 'Admin settings' }

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  let role: string | null = null
  let email: string | null = user!.email ?? null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user!.id)
    .maybeSingle()
  role = (profile?.role as string | undefined) ?? null
  email = (profile?.email as string | undefined) ?? email

  return (
    <ConsolePageShell maxWidth="max-w-2xl">
      <ConsoleHeader eyebrow="Admin console" title="Settings" subtitle="Your admin session." />

      <section className={cn(CONSOLE_CARD, 'divide-y divide-console-border text-sm')}>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <span className="text-console-muted">Signed in as</span>
          <span className="font-semibold">{email ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <span className="text-console-muted">Role</span>
          {role ? <StatusPill status={role} tone={role === 'system_admin' ? 'gold' : 'info'} /> : <span>—</span>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <span className="text-console-muted">Session</span>
          <SignOutButton />
        </div>
      </section>

      <p className="px-1 text-xs text-console-muted">
        Platform configuration (roles, moderation policy, feature flags) lives in the Supabase
        dashboard and migrations for now — this panel focuses on operational control.
      </p>
    </ConsolePageShell>
  )
}