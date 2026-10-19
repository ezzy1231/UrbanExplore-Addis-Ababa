'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  Building2,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu as MenuIcon,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Ticket,
  Utensils,
  UtensilsCrossed,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { ConsoleNotificationBell } from './console-notifications'
import { ConsoleToaster } from './console-toast'

/**
 * Shared console shell for partner and admin dashboards.
 *
 * Tokens come from `.shell-console` in `app/globals.css`, so nothing here
 * depends on `data-theme` and nothing leaks into the public site.
 */

export type ConsoleNavItem = {
  label: string
  href: string
  /** Optional rail grouping label, e.g. "Moderation". */
  section?: string
  /** Attention count rendered as a pill on the rail item. 0 hides it. */
  badge?: number
}

/**
 * Icons are resolved here rather than passed from the server layouts —
 * a component reference cannot cross the RSC boundary. Keyed by label,
 * so the fallback below is what a renamed nav item gets.
 */
const NAV_ICONS: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Overview: LayoutDashboard,
  Users: Users,
  Verification: ShieldCheck,
  Businesses: Building2,
  Organizers: CalendarCheck,
  'Audit Log': BarChart3,
  Metrics: BarChart3,
  Calendar: CalendarDays,
  Events: CalendarDays,
  Reservations: CalendarCheck,
  Tickets: Ticket,
  Analytics: BarChart3,
  Listings: UtensilsCrossed,
  Branches: MapPin,
  Menu: Utensils,
  Settings: Settings,
}

export type ConsoleAccount = {
  organization: string
  role: string
  displayName?: string | null
}

type ConsoleShellProps = {
  navItems: ConsoleNavItem[]
  account: ConsoleAccount
  notificationCount?: number
  /** Rendered as a full-width primary action under the nav. */
  primaryAction?: { label: string; href: string }
  showPromo?: boolean
  /**
   * In-console destinations. Both default to the public marketing/consumer
   * pages, which is wrong for a partner rail — the logo must not dump you
   * out of the console, and Settings must not open the customer account
   * page.
   */
  homeHref?: string
  settingsHref?: string
  /** Optional top-bar search. Only the admin rail passes one today. */
  search?: { action: string; placeholder: string; defaultValue?: string }
  children: React.ReactNode
}

function useIsActive(pathname: string) {
  return useCallback(
    (href: string) => {
      if (href.split('/').length <= 3) return pathname === href
      return pathname.startsWith(href)
    },
    [pathname],
  )
}

function initialsFor(account: ConsoleAccount) {
  const source = account.displayName?.trim() || account.organization
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'PW'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Trap focus while open, close on Escape, lock scroll, restore focus on exit. */
function useDrawerBehaviour(
  open: boolean,
  onClose: () => void,
  restoreFocusRef: React.RefObject<HTMLButtonElement | null>,
) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const opener = restoreFocusRef
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    function focusables() {
      return Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = focusables()
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    focusables()[0]?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      opener.current?.focus()
    }
  }, [open, onClose, restoreFocusRef])

  return panelRef
}

function useDismissOnOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open, onClose])
  return ref
}

function ConsoleBrand({ account, homeHref }: { account: ConsoleAccount; homeHref: string }) {
  return (
    <Link
      href={homeHref}
      className="flex items-center gap-2.5 rounded-xl"
      aria-label={`${account.organization} dashboard`}
    >
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-bold tracking-tight text-white">
          {account.organization}
        </span>
        <span className="block truncate text-[11px] font-medium text-console-nav-muted">
          {account.role}
        </span>
      </span>
    </Link>
  )
}

function ConsoleNav({
  navItems,
  account,
  primaryAction,
  showPromo,
  homeHref,
  settingsHref,
  onNavigate,
}: {
  navItems: ConsoleNavItem[]
  account: ConsoleAccount
  primaryAction?: { label: string; href: string }
  showPromo: boolean
  homeHref: string
  /** Anchored target for the "Boost Now" promo. */
  settingsHref: string
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const isActive = useIsActive(pathname)

  const groups: Array<{ section: string | null; items: ConsoleNavItem[] }> = []
  for (const item of navItems) {
    const section = item.section ?? null
    const last = groups[groups.length - 1]
    if (last && last.section === section) last.items.push(item)
    else groups.push({ section, items: [item] })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <ConsoleBrand account={account} homeHref={homeHref} />
      </div>

      <nav aria-label="Dashboard sections" className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {groups.map((group, groupIndex) => (
          <div key={group.section ?? `group-${groupIndex}`} className="space-y-1">
            {group.section && (
              <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-console-nav-muted/70">
                {group.section}
              </p>
            )}
            {group.items.map((item) => {
              const active = isActive(item.href)
              const Icon = NAV_ICONS[item.label] ?? LayoutDashboard
              const badge = item.badge ?? 0
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative flex min-h-11 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-200',
                    active
                      ? 'bg-console-nav-accent text-white shadow-[0_6px_18px_rgb(63_114_190/0.4)]'
                      : 'text-console-nav-muted hover:bg-console-nav-soft hover:text-white',
                  )}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-white/80"
                    />
                  )}
                  <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.4 : 1.9} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {badge > 0 && (
                    <span
                      aria-label={`${badge} waiting`}
                      className={cn(
                        'flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-5 tabular-nums',
                        active ? 'bg-white text-console-nav-accent' : 'bg-[#D9363E] text-white',
                      )}
                    >
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {primaryAction && (
        <div className="px-3 pt-4">
          <Link href={primaryAction.href} onClick={onNavigate} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-console-indigo-deep">
            <Sparkles className="size-4" />{primaryAction.label}
          </Link>
        </div>
      )}
      {showPromo && (
        <div className="p-3">
          <div className="rounded-2xl bg-gradient-to-br from-console-nav-accent to-[#2F5C9E] p-4 shadow-[0_10px_28px_rgb(0_0_0/0.3)]">
            <span className="flex size-9 items-center justify-center rounded-xl bg-white/20"><Rocket className="size-[18px] text-white" /></span>
            <p className="mt-3 text-sm font-bold leading-snug text-white">Boost Your Event</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/75">Featured placement in Explore and priority email drops.</p>
            <Link href={`${settingsHref}#boost`} onClick={onNavigate} className="mt-3 flex min-h-9 w-full items-center justify-center rounded-lg bg-white px-3 py-2 text-xs font-bold text-console-indigo-deep">Boost Now</Link>
          </div>
        </div>
      )}

    </div>
  )
}

function ConsoleProfile({
  account,
  settingsHref,
}: {
  account: ConsoleAccount
  settingsHref: string
}) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const ref = useDismissOnOutside(open, () => setOpen(false))
  const id = useId()

  // There is no `/auth/signout` route, so sign-out calls Supabase and then
  // hard-navigates, which forces the server components to read the new
  // (empty) session instead of serving a cached one.
  async function signOut() {
    setSigningOut(true)
    setSignOutError(null)
    const supabase = createClient()
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      window.location.assign('/auth/signin')
    } catch {
      // Never leave the button permanently disabled: a failed sign-out has to
      // be retryable, or the partner is stuck signed in with no way out.
      setSigningOut(false)
      setOpen(true)
      setSignOutError('Sign out failed. Please try again.')
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="flex min-h-11 items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 transition-colors hover:bg-console-bg"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-console-indigo to-[#3F72BE] text-xs font-bold text-white">
          {initialsFor(account)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-[13px] font-semibold leading-tight text-console-ink">
            {account.displayName?.trim() || account.organization}
          </span>
          <span className="block text-[11px] leading-tight text-console-muted">{account.role}</span>
        </span>
        <ChevronDown
          className={cn('size-4 text-console-muted transition-transform', open && 'rotate-180')}
          strokeWidth={2.2}
        />
      </button>

      {/* Disclosure panel, not role="menu". The menu keyboard model (arrow-key
            roving focus) is not implemented, and a menu may not contain the
            identity header below. Plain buttons/links are the honest markup. */}
      <div
        id={id}
        hidden={!open}
        className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-console-border bg-console-card py-1.5 shadow-elevate"
      >
        <div className="border-b border-console-border px-4 pb-3 pt-2">
          <p className="truncate text-[13px] font-semibold text-console-ink">{account.displayName?.trim() || account.organization}</p>
          <p className="truncate text-[11px] text-console-muted">{account.role}</p>
        </div>
        <Link
          href={settingsHref}
          onClick={() => setOpen(false)}
          className="flex min-h-11 items-center gap-2.5 px-4 py-2 text-sm text-console-ink transition-colors hover:bg-console-bg"
        >
          <Settings className="size-4 text-console-muted" strokeWidth={2} />
          Settings
        </Link>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="flex min-h-11 w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-console-ink transition-colors hover:bg-console-bg disabled:opacity-50"
        >
          <LogOut className="size-4 text-console-muted" strokeWidth={2} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
        {signOutError && (
          <p role="alert" className="px-4 pb-2 pt-1.5 text-[11px] font-medium text-danger">
            {signOutError}
          </p>
        )}
      </div>
    </div>
  )
}

export function ConsoleShell({
  navItems,
  account,
  notificationCount = 0,
  primaryAction,
  showPromo = true,
  homeHref = '/dashboard',
  settingsHref = '/dashboard',
  search,
  children,
}: ConsoleShellProps) {
  const pathname = usePathname()
  const isActive = useIsActive(pathname)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useDrawerBehaviour(drawerOpen, closeDrawer, menuButtonRef)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const title =
    navItems.find((item) => isActive(item.href) && item.href !== pathname)?.label ??
    navItems.find((item) => item.href === pathname)?.label ??
    navItems[0]?.label ??
    'Dashboard'

  // A route change should never leave the mobile drawer covering the page.
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // `/` focuses the operator search, the way every desktop tool does it.
  useEffect(() => {
    if (!search) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      searchInputRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [search])

  return (
    <div className="shell-console min-h-screen bg-console-bg">
      {/* Skip link comes from the root layout (targets #main). The console
          shell no longer renders its own, which would be a duplicate tab stop. */}

      {/* Desktop rail — fixed, always navy, never scrolls away. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[268px] bg-console-nav lg:block">
        <ConsoleNav
          navItems={navItems}
          account={account}
          primaryAction={primaryAction}
          showPromo={showPromo}
          homeHref={homeHref}
          settingsHref={settingsHref}
        />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Mouse-only dismiss layer. The dialog has its own labelled close
              button and Escape, so this must not be a duplicate tab stop or a
              second "Close navigation" node in the accessibility tree. */}
          <div
            aria-hidden="true"
            onClick={closeDrawer}
            className="absolute inset-0 h-full w-full cursor-default bg-[rgb(10_14_26/0.55)] backdrop-blur-sm"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="animate-fade-in-up absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-console-nav shadow-elevate"
          >
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Close navigation"
              className="absolute right-3 top-4 flex size-11 items-center justify-center rounded-lg text-console-nav-muted transition-colors hover:bg-console-nav-soft hover:text-white"
            >
              <X className="size-5" strokeWidth={2.2} />
            </button>
            <ConsoleNav
              navItems={navItems}
              account={account}
              primaryAction={primaryAction}
              showPromo={showPromo}
              homeHref={homeHref}
              settingsHref={settingsHref}
              onNavigate={closeDrawer}
            />
          </div>
        </div>
      )}

      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-30 border-b border-console-border bg-console-card/85 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              className="flex size-10 items-center justify-center rounded-xl text-console-ink transition-colors hover:bg-console-bg lg:hidden"
            >
              <MenuIcon className="size-5" strokeWidth={2.2} />
            </button>

            <h1 className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight text-console-ink">
              {title}
            </h1>

            {search && (
              <form
                action={search.action}
                method="get"
                role="search"
                className="relative hidden md:block"
              >
                <label htmlFor="console-search" className="sr-only">
                  {search.placeholder}
                </label>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-console-muted"
                  strokeWidth={2.1}
                />
                <input
                  ref={searchInputRef}
                  id="console-search"
                  name="q"
                  type="search"
                  defaultValue={search.defaultValue}
                  placeholder={search.placeholder}
                  aria-keyshortcuts="/"
                  className="h-10 w-44 rounded-xl border border-console-border bg-console-bg/70 pl-9 pr-8 text-[13px] text-console-ink outline-none transition-all placeholder:text-console-muted focus:w-64 focus:border-console-indigo/40 focus:bg-console-card lg:w-56"
                />
                <kbd
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-console-border bg-console-card px-1.5 text-[10px] font-semibold text-console-muted"
                >
                  /
                </kbd>
              </form>
            )}

            <ConsoleNotificationBell
              initialCount={notificationCount}
              settingsHref={settingsHref}
            />
            <ConsoleProfile account={account} settingsHref={settingsHref} />
          </div>
        </header>

        <main id="main" className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      <ConsoleToaster />
    </div>
  )
}
