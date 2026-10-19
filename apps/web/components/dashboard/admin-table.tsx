import Link from 'next/link'
import { AlertTriangle, ArrowDown, ArrowUp, ChevronsUpDown, Inbox, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AdminTableColumn = { key: string; label: string; sortable?: boolean; align?: 'left' | 'right' }
export type AdminTableRow = { key: string; cells: React.ReactNode[] }

export function AdminTable({
  caption,
  columns,
  rows,
  basePath,
  query = {},
  sort,
  direction = 'desc',
  page = 1,
  pageSize = 50,
  total,
  error,
  emptyText,
}: {
  caption: string
  columns: AdminTableColumn[]
  rows: AdminTableRow[]
  basePath: string
  query?: Record<string, string | undefined>
  sort?: string
  direction?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  total: number
  error?: boolean
  emptyText: string
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const firstPage = Math.max(1, page - 2)
  const lastPage = Math.min(pageCount, page + 2)
  const href = (overrides: Record<string, string | number>) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value)
    for (const [key, value] of Object.entries(overrides)) params.set(key, String(value))
    const search = params.toString()
    return search ? `${basePath}?${search}` : basePath
  }

  if (error) {
    return (
      <section
        role="alert"
        className="flex flex-col items-center justify-center rounded-2xl border border-console-border bg-console-card px-6 py-14 text-center shadow-console-card"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-danger/10 text-danger">
          <AlertTriangle className="size-5" strokeWidth={1.9} aria-hidden="true" />
        </span>
        <p className="mt-3 text-sm font-semibold text-console-ink">
          Could not load {caption.toLowerCase()}
        </p>
        <p className="mt-1 max-w-xs text-xs text-console-muted">
          Something went wrong while fetching this data.
        </p>
        <Link
          href={basePath}
          className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-console-indigo px-3.5 text-xs font-semibold text-white transition-colors hover:bg-console-indigo-deep"
        >
          <RefreshCw className="size-3.5" strokeWidth={2.3} aria-hidden="true" />
          Retry
        </Link>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-console-border bg-console-card shadow-console-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-console-border bg-console-bg/60 text-[10px] uppercase tracking-[0.12em] text-console-muted">
              {columns.map((column) => {
                const active = sort === column.key
                const nextDirection = active && direction === 'asc' ? 'desc' : 'asc'
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={cn('whitespace-nowrap px-4 py-3 font-bold', column.align === 'right' && 'text-right')}
                  >
                    {column.sortable ? (
                      <Link
                        href={href({ sort: column.key, direction: nextDirection, page: 1 })}
                        className={cn(
                          'inline-flex min-h-8 items-center gap-1 transition-colors hover:text-console-ink',
                          column.align === 'right' && 'justify-end',
                        )}
                      >
                        {column.label}
                        {active ? (
                          direction === 'asc' ? (
                            <ArrowUp className="size-3.5 text-console-indigo" strokeWidth={2.4} aria-hidden="true" />
                          ) : (
                            <ArrowDown className="size-3.5 text-console-indigo" strokeWidth={2.4} aria-hidden="true" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3.5 opacity-50" strokeWidth={2.2} aria-hidden="true" />
                        )}
                      </Link>
                    ) : (
                      column.label
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-console-border transition-colors last:border-0 hover:bg-console-bg/60"
                >
                  {row.cells.map((cell, index) => (
                    <td
                      key={`${row.key}-${columns[index]?.key ?? index}`}
                      className={cn('px-4 py-2.5 align-middle text-console-ink', columns[index]?.align === 'right' && 'text-right')}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center">
                  <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-console-bg text-console-muted">
                    <Inbox className="size-5" strokeWidth={1.9} aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-console-ink">{emptyText}</p>
                  <p className="mt-1 text-xs text-console-muted">Try adjusting the search or filters.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-console-border px-4 py-2.5 text-xs text-console-muted">
        <span className="tabular-nums">
          {total === 0 ? '0 results' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
        </span>
        <nav aria-label={`${caption} pages`} className="flex items-center gap-1">
          {page > 1 && (
            <Link href={href({ page: page - 1 })} className="flex min-h-9 items-center rounded-lg px-2.5 font-medium transition-colors hover:bg-console-bg hover:text-console-ink">
              Previous
            </Link>
          )}
          {firstPage > 1 && (
            <Link href={href({ page: 1 })} aria-label="Page 1" className="flex min-h-9 min-w-9 items-center justify-center rounded-lg px-2 tabular-nums transition-colors hover:bg-console-bg hover:text-console-ink">
              1
            </Link>
          )}
          {firstPage > 2 && <span aria-hidden="true" className="px-1">…</span>}
          {Array.from({ length: lastPage - firstPage + 1 }, (_, index) => firstPage + index).map((number) => (
            <Link
              key={number}
              href={href({ page: number })}
              aria-current={number === page ? 'page' : undefined}
              className={cn(
                'flex min-h-9 min-w-9 items-center justify-center rounded-lg px-2 tabular-nums transition-colors',
                number === page
                  ? 'bg-console-indigo-soft font-bold text-console-indigo'
                  : 'hover:bg-console-bg hover:text-console-ink',
              )}
            >
              {number}
            </Link>
          ))}
          {lastPage < pageCount - 1 && <span aria-hidden="true" className="px-1">…</span>}
          {lastPage < pageCount && (
            <Link href={href({ page: pageCount })} aria-label={`Page ${pageCount}`} className="flex min-h-9 min-w-9 items-center justify-center rounded-lg px-2 tabular-nums transition-colors hover:bg-console-bg hover:text-console-ink">
              {pageCount}
            </Link>
          )}
          {page < pageCount && (
            <Link href={href({ page: page + 1 })} className="flex min-h-9 items-center rounded-lg px-2.5 font-medium transition-colors hover:bg-console-bg hover:text-console-ink">
              Next
            </Link>
          )}
        </nav>
      </div>
    </section>
  )
}
