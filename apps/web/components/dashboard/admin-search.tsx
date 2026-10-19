import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Search toolbar for the admin list pages — a bordered card holding an
 * icon-led input and an indigo submit button, replacing the hand-rolled
 * forms that each page used to style slightly differently.
 *
 * Query params that must survive a search (active status/role/entity
 * filters) are re-emitted as hidden fields; undefined values are skipped.
 * Server-safe: no hooks, importable from server components.
 */
export function AdminSearchBar({
  id,
  label,
  placeholder,
  defaultValue = '',
  hiddenFields,
  className,
}: {
  id: string
  /** Visually hidden label; also describes the search for screen readers. */
  label: string
  placeholder: string
  defaultValue?: string
  hiddenFields?: Record<string, string | undefined>
  className?: string
}) {
  return (
    <form
      method="get"
      role="search"
      className={cn(
        'flex items-center gap-2 rounded-2xl border border-console-border bg-console-card p-2 shadow-console-card',
        className,
      )}
    >
      <div className="relative min-w-0 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-console-muted"
          strokeWidth={2.1}
        />
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <input
          id={id}
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="h-10 w-full rounded-xl bg-console-bg pl-9 pr-3 text-sm text-console-ink outline-none transition-colors placeholder:text-console-muted focus:bg-console-card focus-visible:ring-2 focus-visible:ring-console-indigo/25"
        />
      </div>
      {hiddenFields &&
        Object.entries(hiddenFields).map(([name, value]) =>
          value ? <input key={name} type="hidden" name={name} value={value} /> : null,
        )}
      <button
        type="submit"
        className="h-10 shrink-0 rounded-xl bg-console-indigo px-5 text-sm font-semibold text-white shadow-[0_6px_18px_rgb(28_58_100/0.28)] transition-colors hover:bg-console-indigo-deep"
      >
        Search
      </button>
    </form>
  )
}
