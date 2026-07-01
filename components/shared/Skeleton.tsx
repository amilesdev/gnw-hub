import { cn } from '@/lib/utils';

/** A single pulsing placeholder block. Pulse stops under prefers-reduced-motion
 *  (handled globally in globals.css). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-2', className)} />;
}

/** Placeholder shaped like an EventCard — used while the events list loads. */
export function EventCardSkeleton() {
  return (
    <div className="card p-4" aria-hidden>
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="mt-3.5 flex gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="mt-2 h-4 w-32" />
    </div>
  );
}

/** Placeholder shaped like the setlist card (numbered song rows). */
export function SetlistSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-0">
          <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A11y-friendly wrapper: announces "Loading" to screen readers while the visual
 *  skeletons render for sighted users. */
export function SkeletonList({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="space-y-3">
      {children}
    </div>
  );
}

/* ── Route-level skeletons ────────────────────────────────────────────────────
 * Rendered by each segment's loading.tsx so a navigation paints instantly (the
 * AppShell/nav stays mounted from the layout) while the async server page
 * streams in. Shapes mirror the real screens to keep layout shift minimal. */

/** Full Home / Dashboard screen placeholder (greeting → verse → events → setlist). */
export function HomeSkeleton() {
  return (
    <SkeletonList>
      <header className="space-y-2 pt-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-8 w-52" />
      </header>
      <Skeleton className="h-16 w-full rounded-2xl" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <EventCardSkeleton />
        <EventCardSkeleton />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <SetlistSkeleton />
      </div>
    </SkeletonList>
  );
}

/** Setlist screen placeholder (title + month chips + song rows). */
export function SetlistScreenSkeleton() {
  return (
    <div className="space-y-5 pt-2">
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
      <SkeletonList>
        <Skeleton className="h-6 w-44" />
        <SetlistSkeleton />
      </SkeletonList>
    </div>
  );
}

/** Events screen placeholder (title + list/month toggle + event cards). */
export function EventsScreenSkeleton() {
  return (
    <div className="space-y-5 pt-2">
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-8 w-40" />
      </div>
      <Skeleton className="h-9 w-40 rounded-full" />
      <SkeletonList>
        <EventCardSkeleton />
        <EventCardSkeleton />
        <EventCardSkeleton />
      </SkeletonList>
    </div>
  );
}

/** Profile screen placeholder (avatar + fields). */
export function ProfileScreenSkeleton() {
  return (
    <div className="space-y-5 pt-2">
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="card space-y-4 p-5">
        <Skeleton className="h-14 w-14 rounded-full" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}
