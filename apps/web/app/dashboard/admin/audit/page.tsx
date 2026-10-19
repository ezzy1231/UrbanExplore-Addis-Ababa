import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { ConsolePageShell, ConsoleHeader, FilterChip } from '@/components/dashboard/console'
import { AdminSearchBar } from '@/components/dashboard/admin-search'
import { AdminTable } from '@/components/dashboard/admin-table'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Audit log · Admin' }
const ENTITY_FILTERS = ['all', 'profile', 'business', 'organizer', 'event', 'reservation'] as const
const PAGE_SIZE = 50

type ActionTone = 'ok' | 'bad' | 'info'

function actionTone(action: string): ActionTone {
  if (/rejected|suspend|cancel|failed/.test(action)) return 'bad'
  if (/approved|verified|confirm|reinstate|published/.test(action)) return 'ok'
  return 'info'
}

const ACTION_DOT: Record<ActionTone, string> = {
  ok: 'bg-success',
  bad: 'bg-danger',
  info: 'bg-console-muted',
}

type AuditRow = { id: string; actor_id: string | null; action: string; entity_type: string | null; entity_id: string | null; metadata: Record<string, unknown> | null; created_at: string }

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams?: { entity?: string; q?: string; page?: string; sort?: string; direction?: string }
}) {
  const q = (searchParams?.q ?? '').trim()
  const entityFilter = ENTITY_FILTERS.includes(searchParams?.entity as (typeof ENTITY_FILTERS)[number]) ? searchParams?.entity ?? 'all' : 'all'
  const page = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1)
  const allowedSorts = ['created_at', 'action', 'entity_type'] as const
  const sort = allowedSorts.includes(searchParams?.sort as (typeof allowedSorts)[number]) ? searchParams?.sort as (typeof allowedSorts)[number] : 'created_at'
  const direction = searchParams?.direction === 'asc' ? 'asc' : 'desc'

  const supabase = await createClient()
  let query = supabase
    .from('audit_logs')
    .select('id, actor_id, action, entity_type, entity_id, metadata, created_at', { count: 'exact' })
    .order(sort, { ascending: direction === 'asc' })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (entityFilter !== 'all') query = query.eq('entity_type', entityFilter)
  if (q) query = query.ilike('action', `%${q}%`)
  const { data, error, count } = await query
  const rows = (data ?? []) as AuditRow[]
  const actorIds = Array.from(new Set(rows.map((row) => row.actor_id).filter((id): id is string => Boolean(id))))
  const actorsRes = actorIds.length ? await supabase.from('profiles').select('id, email').in('id', actorIds) : { data: [] }
  const actors = new Map(((actorsRes.data ?? []) as Array<{ id: string; email: string | null }>).map((actor) => [actor.id, actor.email]))

  return (
    <ConsolePageShell maxWidth="max-w-7xl">
      <ConsoleHeader eyebrow="Admin console" title="Audit log" subtitle="Administrative and partner activity with actor and entity details." />
      <div className="space-y-3">
        <AdminSearchBar
          id="audit-search"
          label="Filter audit actions"
          placeholder="Filter by action…"
          defaultValue={q}
          hiddenFields={{ entity: entityFilter === 'all' ? undefined : entityFilter }}
        />
        <div className="flex flex-wrap gap-2">
          {ENTITY_FILTERS.map((entity) => <FilterChip key={entity} href={`/dashboard/admin/audit?entity=${entity}${q ? `&q=${encodeURIComponent(q)}` : ''}`} active={entityFilter === entity}>{entity}</FilterChip>)}
        </div>
      </div>
      <AdminTable
        caption="Audit activity"
        basePath="/dashboard/admin/audit"
        query={{ q, entity: entityFilter === 'all' ? undefined : entityFilter, sort, direction }}
        sort={sort}
        direction={direction}
        page={page}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
        error={Boolean(error || ('error' in actorsRes && actorsRes.error))}
        emptyText="No audit entries match this filter."
        columns={[{ key: 'action', label: 'Action', sortable: true }, { key: 'actor', label: 'Actor' }, { key: 'entity_type', label: 'Entity', sortable: true }, { key: 'metadata', label: 'Details' }, { key: 'created_at', label: 'Timestamp', sortable: true }]}
        rows={rows.map((row) => {
          const metadata = Object.entries(row.metadata ?? {}).map(([key, value]) => `${key}=${String(value)}`).join(' · ')
          const tone = actionTone(row.action)
          return { key: row.id, cells: [
            <span key="action" className="inline-flex items-center gap-2 whitespace-nowrap font-mono">
              <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', ACTION_DOT[tone])} />
              {row.action}
            </span>,
            <span key="actor">{actors.get(row.actor_id ?? '') ?? 'system'}</span>,
            <span key="entity" className="whitespace-nowrap font-mono text-app-muted">{row.entity_type ?? '—'}{row.entity_id ? ` #${row.entity_id.slice(0, 8)}` : ''}</span>,
            <span key="metadata" className="text-app-muted">{metadata || '—'}</span>,
            <time key="created_at" dateTime={row.created_at} className="whitespace-nowrap font-mono tabular-nums text-app-muted">{new Date(row.created_at).toLocaleString('en-GB')}</time>,
          ] }
        })}
      />
    </ConsolePageShell>
  )
}
