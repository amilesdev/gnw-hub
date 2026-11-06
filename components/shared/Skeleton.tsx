import { cn } from '@/lib/utils';
import { listCard } from '@/lib/ui-classes';

/** A single placeholder block with a moving sheen (`.skeleton` in globals.css).
 *  The sheen stops under prefers-reduced-motion. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} />;
}

/** One event row (EV-C1): date block, then two bars. */
function EventRowSkeleton() {
  return (
    <div className="flex min-h-[72px] items-center gap-3.5 px-4 py-3">
      <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3.5 w-2/5" />
      </div>
    </div>
  );
}

/** A card of event rows — used while an events list loads. */
export function EventCardSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className={listCard} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <EventRowSkeleton key={i} />
      ))}
    </div>
  );
}

/** Placeholder shaped like a setlist card (numbered song rows). */
export function SetlistSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className={listCard} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex min-h-16 items-center gap-3 px-4 py-3">
          <Skeleton className="h-5 w-[22px] shrink-0" />
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
export function SkeletonList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className={cn('space-y-3', className)}>
      {children}
    </div>
  );
}

/** Tab-root header: eyebrow + title bars, leaving the avatar's 56px free. */
function HeaderSkeleton({ titleWidth = 'w-56' }: { titleWidth?: string }) {
  return (
    <div className="mb-6 space-y-3 pr-14">
      <Skeleton className="h-3.5 w-36" />
      <Skeleton className={cn('h-[34px]', titleWidth)} />
    </div>
  );
}

/* ── Route-level skeletons ────────────────────────────────────────────────────
 * Rendered by each segment's loading.tsx so a navigation paints instantly (the
 * AppShell/nav stays mounted from the layout) while the async server page
 * streams in. Shapes mirror the real screens (CMP-15) to keep layout shift
 * minimal. */

/** Home / Dashboard (HM-1/2): verse → (quick actions) → Up next → rows → setlist. */
export function HomeSkeleton({ leader = false }: { leader?: boolean }) {
  return (
    <SkeletonList className="space-y-6">
      <HeaderSkeleton />
      <Skeleton className="h-28 w-full rounded-3xl" />
      {leader && (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-2xl" />
          ))}
        </div>
      )}
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-44 w-full rounded-4xl" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <EventCardSkeleton />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-48 w-full rounded-3xl" />
      </div>
    </SkeletonList>
  );
}

/** Songs (SG-1/2/4/5): header, the Setlists | Library switch, song rows. */
export function SetlistScreenSkeleton() {
  return (
    <div>
      <HeaderSkeleton titleWidth="w-32" />
      <SkeletonList className="space-y-5">
        <Skeleton className="h-11 w-52 rounded-[22px]" />
        <Skeleton className="h-6 w-44" />
        <SetlistSkeleton />
      </SkeletonList>
    </div>
  );
}

/** Events (EV-1): header, Agenda | Month switch, week strip, grouped rows. */
export function EventsScreenSkeleton() {
  return (
    <div>
      <HeaderSkeleton titleWidth="w-36" />
      <SkeletonList className="space-y-5">
        <Skeleton className="h-11 w-48 rounded-[22px]" />
        <div className="flex gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-16 flex-1 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-4 w-28" />
        <EventCardSkeleton rows={3} />
      </SkeletonList>
    </div>
  );
}

/** Generic list screen placeholder (title + rows) — Library, Chat, Crossover, Members… */
export function ListScreenSkeleton() {
  return (
    <div>
      <HeaderSkeleton titleWidth="w-44" />
      <SkeletonList>
        <SetlistSkeleton rows={5} />
      </SkeletonList>
    </div>
  );
}

/** A chat thread placeholder: header bar, a few bubbles, the composer. Full
 *  screen like the thread itself, so it covers the tab bar too. */
export function ChatThreadSkeleton() {
  return (
    <div className="fixed inset-0 z-[45] flex flex-col bg-chat-canvas" role="status" aria-busy="true" aria-label="Loading">
      <div
        className="flex shrink-0 items-center gap-3 border-b border-line bg-glow-top px-4 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-3 px-3 pb-3">
        <Skeleton className="h-10 w-3/5 rounded-[20px]" />
        <Skeleton className="h-14 w-2/3 rounded-[20px]" />
        <Skeleton className="ml-auto h-10 w-1/2 rounded-[20px]" />
        <Skeleton className="h-10 w-2/5 rounded-[20px]" />
        <Skeleton className="ml-auto h-16 w-3/5 rounded-[20px]" />
      </div>
      <div className="shrink-0 px-3 pt-2" style={{ paddingBottom: 'max(1.75rem, env(safe-area-inset-bottom))' }}>
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    </div>
  );
}

/** Profile / Settings (PR-1): header, then the 88px avatar card and rows. */
export function ProfileScreenSkeleton() {
  return (
    <div>
      <div className="mb-6 space-y-3">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-[34px] w-36" />
      </div>
      <SkeletonList className="space-y-6">
        <div className="card flex flex-col items-center gap-3 p-6">
          <Skeleton className="h-[88px] w-[88px] rounded-full" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <SetlistSkeleton rows={3} />
      </SkeletonList>
    </div>
  );
}
