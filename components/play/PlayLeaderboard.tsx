'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ChevronLeft } from '@/components/shared/Icons';
import { Avatar } from '@/components/shared/Avatar';
import { usePlayActive } from '@/lib/play/use-play-active';
import type { PlayPointsRow } from '@/lib/play/queries';

const MEDAL: Record<number, string> = { 1: 'text-amber-400', 2: 'text-zinc-400', 3: 'text-orange-400' };

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function PlayLeaderboard({
  rows,
  currentUserId,
}: {
  rows: PlayPointsRow[];
  currentUserId: string;
}) {
  usePlayActive();
  return (
    <div className="app-shell play-surface">
      <header
        className="flex items-center gap-3 px-5 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.6rem)' }}
      >
        <Link
          href="/play"
          className="row-press grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-soft"
          aria-label="Back to Play"
        >
          <ChevronLeft width={18} height={18} />
        </Link>
        <h1 className="font-display text-xl font-semibold">Leaderboard</h1>
      </header>

      <main className="no-scrollbar flex-1 space-y-2 overflow-y-auto px-5 pb-8">
        {rows.length === 0 || rows.every((r) => r.playPoints === 0) ? (
          <div className="card mt-8 p-8 text-center text-ink-faint">No wins recorded yet. Play a game!</div>
        ) : (
          rows.map((r) => {
            const me = r.id === currentUserId;
            return (
              <div
                key={r.id}
                className={cn(
                  'card flex items-center gap-3 p-3.5',
                  me && 'ring-2 ring-accent',
                  r.rank <= 3 && 'shadow-card-lg',
                )}
              >
                <div className={cn('w-7 text-center font-display text-lg font-bold', MEDAL[r.rank] ?? 'text-ink-faint')}>
                  {r.rank}
                </div>
                <Avatar
                  image={r.image}
                  alt={r.name}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-bold text-ink-soft"
                >
                  {initials(r.name)}
                </Avatar>
                <div className="min-w-0 flex-1 truncate font-semibold text-ink">
                  {r.name}
                  {me && <span className="ml-1.5 text-xs font-normal text-accent-ink dark:text-accent-on">you</span>}
                </div>
                <div className="text-right">
                  <span className="font-display text-lg font-bold text-ink">{r.playPoints}</span>
                  <span className="ml-1 text-xs text-ink-faint">wins</span>
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
