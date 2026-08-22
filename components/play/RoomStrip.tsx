'use client';

import { cn } from '@/lib/utils';
import { Avatar } from '@/components/shared/Avatar';
import { Check } from '@/components/shared/Icons';
import type { LeaderboardEntry } from '@/lib/play/types';

function initials(name: string): string {
  return name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

/**
 * The room, mid-question.
 *
 * Before this, only the host could see how many people had answered ("4 answers
 * locked in") and players saw nothing at all — you locked in and then sat in
 * silence with no sense that anyone else was there. ANSWER_LOCKED already
 * broadcasts a playerId to every client, so every client can light the exact
 * person who just committed. That turns a number into a room.
 *
 * Faces stay dim until they answer, so the strip fills up like seats taking
 * their places. Locked-in state is carried by brightness AND a check badge, not
 * by colour alone.
 */
export function RoomStrip({
  players,
  answered,
  className,
}: {
  players: LeaderboardEntry[];
  answered: Set<string>;
  className?: string;
}) {
  if (players.length === 0) return null;
  const count = players.filter((p) => answered.has(p.playerId)).length;

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="no-scrollbar flex max-w-full items-center justify-center gap-2 overflow-x-auto px-1 py-1">
        {players.map((p) => {
          const inn = answered.has(p.playerId);
          return (
            <span
              key={p.playerId}
              className={cn(
                'relative shrink-0 transition-all duration-300',
                inn ? 'play-lock-in opacity-100' : 'opacity-35 grayscale',
              )}
              title={p.name}
            >
              <Avatar
                image={p.image}
                alt=""
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-xl text-[0.7rem] font-bold ring-2 transition-colors',
                  inn
                    ? 'bg-white/15 text-white ring-[rgb(var(--play-green))]'
                    : 'bg-white/10 text-white/70 ring-transparent',
                )}
              >
                {initials(p.name)}
              </Avatar>
              {inn && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full text-play-ink"
                  style={{ background: 'rgb(var(--play-green))' }}
                  aria-hidden
                >
                  <Check width={10} height={10} strokeWidth={3.4} />
                </span>
              )}
            </span>
          );
        })}
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] stage-faint" aria-live="polite">
        {count} of {players.length} locked in
      </p>
    </div>
  );
}
