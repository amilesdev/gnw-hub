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
