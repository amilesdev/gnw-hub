'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useGameChannel } from '@/lib/play/realtime-client';
import { playSfx, stopSfx } from '@/lib/play/audio';
import { haptics } from '@/lib/haptics';
import { usePlayActive } from '@/lib/play/use-play-active';
import { Avatar } from '@/components/shared/Avatar';
import type { FinalResultPayload } from '@/lib/play/types';

const CONFETTI_COLORS = ['#E8C547', '#FFFFFF', '#AEBE8A', '#5E7048', '#C58A3D'];

function initials(name: string): string {
  return name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

// Podium order on screen: 2nd (left), 1st (center), 3rd (right).
const SLOTS: { place: 1 | 2 | 3; h: string; delay: number; size: string }[] = [
  { place: 2, h: 'h-24', delay: 0.3, size: 'h-14 w-14' },
  { place: 1, h: 'h-32', delay: 0.9, size: 'h-16 w-16' },
  { place: 3, h: 'h-16', delay: 0.6, size: 'h-12 w-12' },
];
const MEDAL: Record<number, string> = { 1: 'bg-amber-400', 2: 'bg-zinc-300', 3: 'bg-orange-400' };

export function Results({
  sessionId,
  results,
  isHost,
  mePlayerId,
}: {
  sessionId: string;
  results: FinalResultPayload;
  isHost: boolean;
  mePlayerId: string | null;
}) {
  usePlayActive();
  const router = useRouter();
  const [showStats, setShowStats] = useState(false);
  const [confettiOn, setConfettiOn] = useState(false);

  const byPlace = useMemo(
    () => new Map(results.podium.map((p) => [p.place, p])),
    [results.podium],
  );
  const winners = new Set(results.winnerPlayerIds);

  // Follow the host into a rematch.
  useGameChannel(sessionId, (e) => {
    if (e.type === 'PLAY_AGAIN') router.push(`/play/session/${e.sessionId}/lobby`);
  });

  // Celebration sequence.
  useEffect(() => {
    haptics.success();
    playSfx('celebration-music', { volume: 0.7 });
    const drops = [0.3, 0.6, 0.9].map((d, i) =>
      setTimeout(() => playSfx('podium-land', { volume: 0.8 }), d * 1000 + i * 50),
    );
    const confetti = setTimeout(() => setConfettiOn(true), 1100);
    const autoStats = setTimeout(() => setShowStats(true), 4200);
    return () => {
      drops.forEach(clearTimeout);
      clearTimeout(confetti);
      clearTimeout(autoStats);
      stopSfx('celebration-music');
    };
  }, []);

  const playAgain = async () => {
    try {
      const { id } = await apiFetch<{ id: string }>(`/api/play/sessions/${sessionId}/play-again`, {
        method: 'POST',
      });
      router.push(`/play/session/${id}/lobby`);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="app-shell relative overflow-hidden bg-ink text-white">
      {/* Drifting particles */}
      <div className="pointer-events-none absolute inset-0 animate-fade-in">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="animate-floaty absolute h-1 w-1 rounded-full bg-white/40"
            style={{
              left: `${(i * 53) % 100}%`,
              top: `${(i * 37) % 100}%`,
              animationDelay: `${(i % 5) * 0.4}s`,
            }}
          />
        ))}
      </div>

      {/* Confetti */}
      {confettiOn && (
        <div className="pointer-events-none absolute inset-0 z-30">
          {Array.from({ length: 70 }).map((_, i) => (
            <span
              key={i}
              className="play-confetti absolute top-0 h-2 w-2 rounded-sm"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDuration: `${1.8 + Math.random() * 1.6}s`,
                animationDelay: `${Math.random() * 0.6}s`,
              }}
            />
          ))}
        </div>
      )}

      {!showStats ? (
        <button
          type="button"
          onClick={() => setShowStats(true)}
          className="relative z-20 flex flex-1 flex-col items-center justify-end pb-10"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}
        >
          <h1 className="animate-fade-in mb-10 font-display text-3xl font-bold">🏆 Winner!</h1>
          <div className="flex items-end gap-2">
            {SLOTS.map((slot) => {
              const entry = byPlace.get(slot.place);
              if (!entry) return <div key={slot.place} className="w-20" />;
              const isChamp = slot.place === 1;
              return (
                <div key={slot.place} className="flex w-24 flex-col items-center">
                  <Avatar
                    image={entry.image}
                    alt={entry.name}
                    className={cn(
                      'play-avatar-drop mb-2 grid place-items-center rounded-2xl bg-white/15 font-bold backdrop-blur',
                      slot.size,
                      isChamp && 'play-champ-bob',
                    )}
                    style={{ animationDelay: `${slot.delay}s` }}
                  >
                    {initials(entry.name)}
                  </Avatar>
                  <div className="mb-1 max-w-full truncate text-center text-sm font-semibold">{entry.name}</div>
                  <div className="text-xs text-white/60">{entry.score}</div>
                  <div
                    className={cn('play-podium-rise mt-2 w-full rounded-t-xl', slot.h, MEDAL[slot.place])}
                    style={{ animationDelay: `${slot.delay}s` }}
                  >
                    <div className="pt-2 text-center font-display text-2xl font-bold text-ink">{slot.place}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-8 text-xs text-white/50">Tap to see full results</p>
        </button>
      ) : (
        <StatsPanel results={results} winners={winners} mePlayerId={mePlayerId} />
      )}

      {/* Actions */}
      {showStats && (
        <div
          className="relative z-20 border-t border-white/10 px-5 pt-3"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex gap-3">
            {isHost && (
              <button type="button" onClick={playAgain} className="btn-primary flex-1">
                Play Again
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push('/play')}
              className={cn(
                'flex-1 rounded-2xl bg-white/15 px-5 py-3.5 font-semibold text-white transition active:scale-[0.97]',
                !isHost && 'flex-1',
              )}
            >
              Back to Play
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatsPanel({
  results,
  winners,
  mePlayerId,
}: {
  results: FinalResultPayload;
  winners: Set<string>;
  mePlayerId: string | null;
}) {
  return (
    <div
      className="animate-sheet-up no-scrollbar relative z-20 flex-1 overflow-y-auto px-5 pb-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
    >
      <h1 className="mb-4 font-display text-2xl font-bold">Final results</h1>

      {results.mode === 'team_battle' && results.teams && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          {[...results.teams]
            .sort((a, b) => b.teamPoints - a.teamPoints)
            .map((t) => (
              <div key={t.id} className="rounded-2xl bg-white/10 p-3 text-center">
                <div className="truncate text-xs font-bold uppercase text-white/60">{t.name}</div>
                <div className="font-display text-2xl font-bold">{t.teamPoints}</div>
                <div className="text-xs text-white/50">{t.individualSum} pts</div>
              </div>
            ))}
        </div>
      )}

      <div className="space-y-2">
        {results.rankings.map((e) => (
          <div
            key={e.playerId}
            className={cn(
              'flex items-center gap-3 rounded-2xl px-3 py-2.5',
              e.playerId === mePlayerId ? 'bg-white/20 ring-1 ring-white/40' : 'bg-white/8',
            )}
          >
            <span className="w-5 text-center font-bold text-white/60">{e.rank}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">
              {winners.has(e.playerId) && '👑 '}
              {e.name}
              {results.mode === 'survival' && e.hearts !== undefined && (
                <span className="ml-1 text-xs">{e.isEliminated ? '💀' : '❤️'.repeat(e.hearts)}</span>
              )}
              {e.team && <span className="ml-1 text-xs text-white/50">· {e.team}</span>}
            </span>
            <span className="font-display font-bold tabular-nums">{e.score}</span>
          </div>
        ))}
      </div>

      {results.mode === 'survival' && results.eliminationOrder && results.eliminationOrder.length > 0 && (
        <div className="mt-5">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-white/50">Eliminated</h2>
          <div className="text-sm text-white/70">
            {results.eliminationOrder.map((p, i) => (
              <span key={p.playerId}>
                {i > 0 && ' → '}
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
