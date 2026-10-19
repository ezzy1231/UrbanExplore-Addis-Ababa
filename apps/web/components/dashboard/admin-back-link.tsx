import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Consistent back navigation for admin drilldown pages, replacing the
 * uppercase labelless arrows each page used to hand-roll.
 */
export function AdminBackLink({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-console-muted transition-colors hover:text-console-ink',
        className,
      )}
    >
      <ArrowLeft aria-hidden="true" className="size-3.5" strokeWidth={2.4} />
      {children}
    </Link>
  )
}
