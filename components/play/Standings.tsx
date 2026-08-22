'use client';

import { cn } from '@/lib/utils';
import { useFlip } from '@/lib/play/use-flip';
import { STREAK_HOT, STREAK_MIN } from '@/lib/play/use-streaks';
import { Avatar } from '@/components/shared/Avatar';
import { Flame, RankUp, RankDown } from '@/components/shared/Icons';
import { Hearts } from './Hearts';
import { CountUp } from './CountUp';
import type { GameMode, LeaderboardEntry } from '@/lib/play/types';

function initials(name: string): string {
  return name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

/** Top three get their metal; everyone else gets a plain numeral. */
const MEDAL: Record<number, string> = {
  1: 'rgb(var(--play-yellow))',
  2: 'rgb(var(--play-silver))',
  3: 'rgb(var(--play-orange))',
};

/**
 * Live standings between rounds.
 *
 * Three things were missing and all three are about being able to find yourself
 * and read the room at a glance:
 *  · faces — the app has profile pictures and this screen showed name text
 *  · movement — rows hard-swapped, so nobody ever saw themselves get passed
 *  · momentum — a run of correct answers left no trace
 *
 * Rows now travel to their new rank (FLIP, transform-only), carry the player's
 * avatar, show how many places they moved this round, and flag a live streak.
 */
export function Standings({
  entries,
  mePlayerId,
  mode,
  streaks,
  prevRanks,
}: {
  entries: LeaderboardEntry[];
  mePlayerId: string | null;
  mode: GameMode;
  streaks: Map<string, number>;
  /** Ranks as of the end of the previous round. Owned by the parent, which
   *  stays mounted across phases — see the note in LiveGame. */
  prevRanks: Map<string, number>;
}) {
  // Top 5, then your own row pinned below a break when you're outside it, so
  // every player can always find themselves.
  const rows = (() => {
    const top = entries.slice(0, 5).map((entry) => ({ entry, isGap: false }));
    const mine = entries.find((e) => e.playerId === mePlayerId);
    if (!mine || top.some((r) => r.entry.playerId === mine.playerId)) return top;
    return [...top, { entry: mine, isGap: true }];
  })();

  // How far each player moved since the last round closed.
  const deltas = new Map<string, number>();
  for (const e of entries) {
    const before = prevRanks.get(e.playerId);
    if (before !== undefined && before !== e.rank) deltas.set(e.playerId, before - e.rank);
  }

  const flip = useFlip([entries.map((e) => e.playerId).join('|')]);

  return (
    <ul className="space-y-2">
      {rows.map(({ entry: e, isGap }, i) => {
        const me = e.playerId === mePlayerId;
        const delta = deltas.get(e.playerId);
        const streak = streaks.get(e.playerId) ?? 0;
        const hot = streak >= STREAK_HOT;

        return (
          <li key={e.playerId}>
            {isGap && (
              <div className="py-1 text-center text-xs font-black tracking-[0.4em] stage-faint" aria-hidden>
                ···
              </div>
            )}
            <div
              ref={flip(e.playerId)}
              className={cn(
                'play-flip play-panel-in flex items-center gap-3 rounded-2xl px-3 py-2.5',
                me
                  ? 'bg-white/15 ring-2 ring-[rgb(var(--play-green))]'
                  : 'bg-white/[0.07] ring-1 ring-white/10',
              )}
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <span
                className="w-5 shrink-0 text-center font-display text-base font-black tabular-nums"
                style={{ color: MEDAL[e.rank] ?? 'rgb(var(--stage-ink-faint))' }}
              >
                {e.rank}
              </span>

              <Avatar
                image={e.image}
                alt=""
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 text-[0.7rem] font-bold text-white"
              >
                {initials(e.name)}
              </Avatar>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="min-w-0 truncate font-semibold stage-ink">{e.name}</span>
                  {me && (
                    <span className="shrink-0 text-[0.6rem] font-black uppercase tracking-wider stage-faint">
                      you
                    </span>
                  )}
                </span>
                {streak >= STREAK_MIN && (
                  <span
                    className="mt-0.5 flex items-center gap-1 text-[0.68rem] font-bold"
                    style={{ color: hot ? 'rgb(var(--play-heat))' : 'rgb(var(--stage-ink-soft))' }}
                  >
                    <Flame
                      width={11}
                      height={11}
                      className={cn(hot && 'play-heat-flicker')}
                      aria-hidden
                    />
                    {streak} in a row
                  </span>
                )}
              </span>

              {delta !== undefined && (
                <span
                  className="flex shrink-0 items-center gap-0.5 text-[0.68rem] font-black tabular-nums"
                  style={{ color: delta > 0 ? 'rgb(var(--play-green))' : 'rgb(var(--play-pink))' }}
                  aria-label={`${delta > 0 ? 'Up' : 'Down'} ${Math.abs(delta)} ${
                    Math.abs(delta) === 1 ? 'place' : 'places'
                  }`}
                >
                  {delta > 0 ? <RankUp width={9} height={9} /> : <RankDown width={9} height={9} />}
                  {Math.abs(delta)}
                </span>
              )}

              {mode === 'survival' && e.hearts !== undefined && (
                <Hearts hearts={e.hearts} eliminated={e.isEliminated} size={13} />
              )}

              <CountUp
                value={e.score}
                className="shrink-0 font-display text-base font-black tabular-nums stage-ink"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
