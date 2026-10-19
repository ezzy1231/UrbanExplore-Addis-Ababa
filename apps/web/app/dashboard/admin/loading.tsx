/**
 * Route-level loading skeleton for the admin console. Mirrors the overview
 * layout (header, KPI row, chart row, split queue/feed, directory table) so
 * the first paint matches where the content lands. Uses console tokens —
 * this boundary only ever renders inside `.shell-console`.
 */
export default function AdminLoading() {
  return (
    <div className="min-h-full px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div
        className="mx-auto w-full max-w-7xl space-y-8"
        aria-busy="true"
        aria-label="Loading admin content"
      >
        {/* Page header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-3">
            <div className="h-3 w-28 animate-pulse rounded-full bg-console-border" />
            <div className="h-9 w-52 animate-pulse rounded-xl bg-console-border" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded-full bg-console-border/70" />
          </div>
          <div className="h-12 w-52 animate-pulse rounded-xl border border-console-border bg-console-card" />
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-[148px] animate-pulse rounded-2xl border border-console-border bg-console-card"
            />
          ))}
        </div>

        {/* Growth chart + attention card */}
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="h-[420px] animate-pulse rounded-2xl border border-console-border bg-console-card xl:col-span-2" />
          <div className="h-[420px] animate-pulse rounded-2xl border border-console-border bg-console-card" />
        </div>

        {/* Pending queue + activity feed */}
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="h-72 animate-pulse rounded-2xl border border-console-border bg-console-card" />
          <div className="h-72 animate-pulse rounded-2xl border border-console-border bg-console-card" />
        </div>

        {/* Directory table */}
        <div className="h-80 animate-pulse rounded-2xl border border-console-border bg-console-card" />
      </div>
    </div>
  )
}
