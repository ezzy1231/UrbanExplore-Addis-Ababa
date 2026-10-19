import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  ConsolePageShell,
  ConsoleHeader,
  StatusPill,
} from '@/components/dashboard/console'
import { statusTone } from '@/components/dashboard/console-shared'
import { CONSOLE_CARD } from '@/components/dashboard/console-tokens'
import { AdminBackLink } from '@/components/dashboard/admin-back-link'
import {
  getVerificationRequest,
  signVerificationDocuments,
  type VerificationDocument,
} from '@/lib/dashboard/verification-data'
import VerificationReviewActions from '@/components/dashboard/verification-review-actions'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Review request · Admin' }

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-console-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-console-ink">{value || '—'}</dd>
    </div>
  )
}

function readableSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * One request, with the documents an admin actually needs to see.
 *
 * The bucket is private, so the links below are signed URLs minted per render
 * with a 5 minute TTL — the only way a reviewer can open a licence, and a link
 * that stops working shortly after being copied into a chat.
 */
export default async function AdminVerificationReviewPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/signin?next=/dashboard/admin/verification/${params.id}`)

  const found = await getVerificationRequest(supabase, params.id)
  if (!found) notFound()

  const { request, entityName, ownerEmail } = found
  const signed = await signVerificationDocuments(supabase, request.documents)

  const entityHref =
    request.entity_type === 'business'
      ? `/dashboard/admin/businesses/${request.entity_id}`
      : `/dashboard/admin/organizers/${request.entity_id}`

  return (
    <ConsolePageShell>
      <AdminBackLink href="/dashboard/admin/verification">Back to queue</AdminBackLink>

      <ConsoleHeader
        eyebrow="Verification"
        title={entityName}
        subtitle={`Submitted ${new Date(request.submitted_at).toLocaleString('en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}`}
        action={
          <Link
            href={entityHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-console-border bg-console-card px-4 text-sm font-semibold text-console-ink transition-colors hover:bg-console-bg"
          >
            Open partner record
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusPill status={request.status} tone={statusTone(request.status)} />
        <span className="text-sm text-console-muted">
          {request.entity_type === 'business' ? 'Restaurant business' : 'Event organizer'}
          {ownerEmail ? ` · ${ownerEmail}` : ''}
        </span>
      </div>

      <section className={cn(CONSOLE_CARD, 'p-6')}>
        <h2 className="text-base font-bold text-console-ink">Claimed details</h2>
        <p className="mt-1 text-sm text-console-muted">
          Snapshotted when the partner submitted. Later profile edits do not change this.
        </p>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Legal name" value={request.legal_name} />
          <Field label="Registration number" value={request.registration_number} />
          <Field label="Tax ID" value={request.tax_id} />
          <Field label="Phone" value={request.phone} />
          <Field label="City" value={request.city} />
          <Field label="Website" value={request.website} />
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Registered address" value={request.address} />
          </div>
          {request.note && (
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Partner note" value={request.note} />
            </div>
          )}
        </dl>
      </section>

      <section className={cn(CONSOLE_CARD, 'p-6')}>
        <h2 className="text-base font-bold text-console-ink">Documents</h2>
        {request.documents.length === 0 ? (
          <p className="mt-2 text-sm text-console-muted">
            No documents were attached to this request.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {request.documents.map((doc: VerificationDocument) => {
              const url = signed.get(doc.path)
              return (
                <li
                  key={doc.path}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-console-border bg-console-bg/60 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-console-ink">
                      {doc.label}
                    </span>
                    <span className="text-xs text-console-muted">
                      {readableSize(doc.sizeBytes)}
                      {doc.contentType ? ` · ${doc.contentType}` : ''}
                    </span>
                  </span>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-ember underline underline-offset-2"
                    >
                      Open
                    </a>
                  ) : (
                    <span className="text-sm text-console-blush-ink">
                      Link unavailable
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-4 text-xs text-console-muted">
          Links are signed and expire after 5 minutes. Reload the page for fresh ones.
        </p>
      </section>

      {request.reviewer_note && (
        <section className={cn(CONSOLE_CARD, 'p-6')}>
          <h2 className="text-base font-bold text-console-ink">Reviewer note</h2>
          <p className="mt-2 text-sm text-console-ink">{request.reviewer_note}</p>
          {request.decided_at && (
            <p className="mt-2 text-xs text-console-muted">
              Decided {new Date(request.decided_at).toLocaleString('en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          )}
        </section>
      )}

      <section className={cn(CONSOLE_CARD, 'p-6')}>
        <h2 className="mb-4 text-base font-bold text-console-ink">Decision</h2>
        <VerificationReviewActions
          requestId={request.id}
          status={request.status}
        />
      </section>
    </ConsolePageShell>
  )
}