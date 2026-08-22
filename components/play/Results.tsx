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
import { Crown } from '@/components/shared/Icons';
import { Hearts } from './Hearts';
import { CountUp } from './CountUp';
import { StageBackdrop } from './StageBackdrop';
import type { FinalResultPayload, PodiumEntry } from '@/lib/play/types';

function initials(name: string): string {
  return name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

/**
 * Podium slots, in the order they stand on screen: 2nd left, 1st centre, 3rd
 * right. `at` is when that place is revealed — lowest place first, counting up
 * to the champion, so the sequence builds instead of arriving all at once.
 */
const SLOTS: {
  place: 1 | 2 | 3;
  at: number;
  riser: string;
  avatar: string;
  metal: string;
  /** The pool of light on the floor. This is the actual focal point. */
  pool: string;
  /** Key light on the person standing in it. */
  key: string;
  /** Score type size — the champion's number is the biggest thing here. */
  score: string;
}[] = [
  { place: 2, at: 0.75, riser: 'h-32', avatar: 'h-16 w-16', metal: 'var(--play-silver)', pool: '0.26', key: '0.2', score: 'text-xl' },
  { place: 1, at: 1.3, riser: 'h-44', avatar: 'h-20 w-20', metal: 'var(--play-yellow)', pool: '0.46', key: '0.3', score: 'text-2xl' },
  { place: 3, at: 0.25, riser: 'h-20', avatar: 'h-14 w-14', metal: 'var(--play-orange)', pool: '0.24', key: '0.18', score: 'text-lg' },
];

const CONFETTI = ['--play-yellow', '--play-green', '--play-pink', '--play-blue', '--play-orange'];

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
  const [burst, setBurst] = useState(false);

  const byPlace = useMemo(() => new Map(results.podium.map((p) => [p.place, p])), [results.podium]);
  const winners = new Set(results.winnerPlayerIds);
  const champion = byPlace.get(1);

  // Follow the host into a rematch.
  useGameChannel(sessionId, (e) => {
    if (e.type === 'PLAY_AGAIN') router.push(`/play/session/${e.sessionId}/lobby`);
  });

  // The house sequence. Each riser lands ~0.56s into its 0.78s rise, so the
  // thuds are pinned to the landing frame rather than the trigger.
  useEffect(() => {
    haptics.success();
    playSfx('celebration-music', { volume: 0.7 });
    const lands = SLOTS.filter((s) => byPlace.has(s.place)).map((s) =>
      setTimeout(() => playSfx('podium-land', { volume: 0.8 }), (s.at + 0.56) * 1000),
    );
    const fire = setTimeout(() => setBurst(true), 2000);
    const autoStats = setTimeout(() => setShowStats(true), 6000);
    return () => {
      lands.forEach(clearTimeout);
      clearTimeout(fire);
      clearTimeout(autoStats);
      stopSfx('celebration-music');
    };
  }, [byPlace]);

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
    <div className="app-shell play-stage play-stage--house relative overflow-hidden">
      {/* The house behind the podium: whatever art the leader has supplied, or
          the painted ground when there is none. Always under the content —
          both branches below set their own `relative z-10`. */}
      <StageBackdrop />

      {!showStats ? (
        // Title and podium are one picture, anchored to the floor: a stage
        // floor belongs at the bottom of the frame, and the space above it is
        // the room. The title used to be pinned to the very top instead,
        // leaving a third of the screen as a void in between.
        <button
          type="button"
          onClick={() => setShowStats(true)}
          className="relative z-10 flex flex-1 flex-col items-center justify-end"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
          aria-label="Show full results"
        >
          <div className="animate-fade-in mb-9 text-center">
            <p className="text-xs font-black uppercase tracking-[0.28em] stage-faint">
              {results.mode === 'survival' ? 'Last one standing' : 'Final call'}
            </p>
            {champion && (
              <h1 className="mt-1.5 font-display text-[2rem] font-bold leading-tight tracking-[-0.02em] stage-ink">
                {champion.name}
              </h1>
            )}
          </div>

          {/* ── The stage ── */}
          <div className="relative flex w-full items-end justify-center gap-1.5 px-4">
            {SLOTS.map((slot) => {
              const entry = byPlace.get(slot.place);
              // An empty slot still holds its column so the podium stays
              // centred in a 2-player game.
              if (!entry) return <div key={slot.place} className="w-[5.75rem]" />;
              return (
                <PodiumColumn
                  key={slot.place}
                  slot={slot}
                  entry={entry}
                  burst={burst && slot.place === 1}
                />
              );
            })}
          </div>

          {/* Stage floor: a lit lip with the light spilling off the front. */}
          <div className="relative w-full">
            <div
              className="h-px w-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgb(var(--play-beam) / 0.5), transparent)',
              }}
            />
            <div
              className="h-14 w-full"
              style={{
                background: 'linear-gradient(180deg, rgb(var(--play-beam) / 0.08), transparent 75%)',
              }}
            />
          </div>

          <p
            className="-mt-9 text-xs font-bold uppercase tracking-[0.16em] stage-faint"
            style={{ paddingBottom: 'max(1.75rem, env(safe-area-inset-bottom))' }}
          >
            Tap for full results
          </p>
        </button>
      ) : (
        <StatsPanel results={results} winners={winners} mePlayerId={mePlayerId} />
      )}

      {showStats && (
        <div
          className="relative z-10 border-t border-white/10 px-5 pt-3"
          style={{
            paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
            background: 'rgb(var(--stage-bg) / 0.9)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex gap-3">
            {isHost && (
              <button
                type="button"
                onClick={playAgain}
                className="play-press flex-1 rounded-2xl py-3.5 font-display text-base font-bold text-play-ink shadow-pop"
                style={{ background: 'rgb(var(--play-green))' }}
              >
                Play again
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push('/play')}
              className="flex-1 rounded-2xl bg-white/15 px-5 py-3.5 font-semibold stage-ink transition active:scale-[0.97]"
            >
              Back to Play
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** One place on the podium: its light, its avatar, its score, its riser. */
function PodiumColumn({
  slot,
  entry,
  burst,
}: {
  slot: (typeof SLOTS)[number];
  entry: PodiumEntry;
  burst: boolean;
}) {
  const champ = slot.place === 1;

  return (
    // min-w-0 is required, not cosmetic: a flex item won't shrink below its
    // min-content width, so a long name like "Alonzo Miles" was forcing the
    // column wider than 5.75rem and shunting the neighbouring podium places
    // sideways — the `truncate` below never got a chance to fire.
    <div className="relative flex w-[5.75rem] min-w-0 flex-col items-center">
      {/* The pool on the floor. THIS is the light — the shaft that used to hang
          above it was a blurred wedge cropped by the shell, which reads as a
          grey sail rather than as a beam, so it's gone. A lamp is legible by
          where it lands, and a flat ellipse at the foot of the riser lands. */}
      <span
        aria-hidden
        className="play-pool pointer-events-none absolute bottom-0 left-1/2 h-32 w-[13rem] rounded-[50%]"
        style={{
          animationDelay: `${slot.at + 0.2}s`,
          background: `radial-gradient(ellipse at center, rgb(${
            champ ? 'var(--play-yellow)' : 'var(--play-beam)'
          } / ${slot.pool}), transparent 68%)`,
          filter: 'blur(14px)',
        }}
      />

      {/* The key on the person standing in it — a soft round wash behind the
          avatar, so they read as lit instead of pasted onto the dark. */}
      <span
        aria-hidden
        className="play-key pointer-events-none absolute left-1/2 top-0 h-28 w-28 rounded-full"
        style={{
          animationDelay: `${slot.at + 0.15}s`,
          background: `radial-gradient(circle at center, rgb(${
            champ ? 'var(--play-yellow)' : 'var(--play-beam)'
          } / ${slot.key}), transparent 70%)`,
          filter: 'blur(10px)',
        }}
      />

      {champ && (
        <Crown
          width={28}
          height={28}
          className="play-avatar-drop relative mb-1.5"
          style={{ animationDelay: `${slot.at + 0.25}s`, color: 'rgb(var(--play-yellow))' }}
          aria-hidden
        />
      )}

      <div className="relative">
        {/* The idle breath wraps only the avatar; the burst is a sibling so the
            confetti launches from a fixed point instead of drifting with it. */}
        <div className={cn(champ && 'play-champ-idle')}>
          <Avatar
            image={entry.image}
            alt=""
            className={cn(
              'play-avatar-drop grid place-items-center rounded-2xl bg-white/15 font-bold stage-ink backdrop-blur',
              slot.avatar,
            )}
            style={{
              animationDelay: `${slot.at}s`,
              boxShadow: `0 0 0 2px rgb(${slot.metal} / 0.75), 0 14px 34px -12px rgb(${slot.metal} / 0.6)`,
            }}
          >
            {initials(entry.name)}
          </Avatar>
        </div>
        {burst && <ConfettiBurst />}
      </div>

      <div className="mt-2 w-full max-w-full truncate text-center text-sm font-semibold stage-ink">
        {entry.name}
      </div>

      {/* The score is the thing the whole game was for. It used to be set at
          12px in the faintest grey on the screen — the same treatment as a
          timestamp — so the number you played twenty questions for read as
          metadata. It is now the second-largest thing in the column, struck in
          the metal of the place it won. */}
      <div
        className="mt-0.5 flex flex-col items-center leading-none"
        style={{ '--metal': slot.metal } as React.CSSProperties}
      >
        <CountUp
          value={entry.score}
          delay={slot.at * 1000}
          className={cn(
            'play-score-metal block font-display font-black tabular-nums',
            slot.score,
          )}
        />
        <span
          className="mt-1 text-[0.5rem] font-black uppercase tracking-[0.2em]"
          style={{ color: `rgb(${slot.metal} / 0.7)` }}
        >
          pts
        </span>
      </div>

      {/* The riser. A lighter cap across the top reads as the surface catching
          the beam — depth without pretending to be a 3D render. */}
      <div
        className={cn('play-riser-up mt-2 w-full overflow-hidden rounded-t-xl', slot.riser)}
        style={{
          animationDelay: `${slot.at}s`,
          background: `linear-gradient(180deg, rgb(${slot.metal} / 0.95), rgb(${slot.metal} / 0.55))`,
        }}
      >
        <div
          className="h-1.5 w-full"
          style={{ background: `rgb(var(--play-beam) / ${champ ? 0.75 : 0.45})` }}
        />
        <div
          className="pt-1.5 text-center font-display text-2xl font-black"
          style={{ color: 'rgb(var(--play-ink))' }}
        >
          {slot.place}
        </div>
      </div>
    </div>
  );
}

/**
 * Confetti fired from the champion rather than dropped from the ceiling.
 *
 * The old version rained 70 squares from y=0 with a shared keyframe, which is
 * the default confetti and reads as a screensaver. Each piece here gets its own
 * launch vector, size and shape, so the burst has an origin — the person who
 * won — and the eye follows it outward from them.
 */
function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => {
        const angle = (i / 44) * Math.PI * 2 + Math.random() * 0.4;
        const power = 90 + Math.random() * 190;
        return {
          i,
          dx: Math.cos(angle) * power,
          // Biased upward on launch; the long fall is baked into the keyframe's
          // end position, so gravity comes for free.
          dy: Math.sin(angle) * power * 0.62 + 190 + Math.random() * 120,
          rot: `${(Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540)}deg`,
          color: CONFETTI[i % CONFETTI.length],
          w: 4 + Math.random() * 5,
          h: 7 + Math.random() * 8,
          round: Math.random() > 0.72,
          dur: 1.5 + Math.random() * 1.3,
        };
      }),
    [],
  );

  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-0 w-0" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.i}
          className={cn('play-burst absolute', p.round ? 'rounded-full' : 'rounded-[1px]')}
          style={
            {
              width: `${p.w}px`,
              height: `${p.round ? p.w : p.h}px`,
              backgroundColor: `rgb(var(${p.color}))`,
              animationDuration: `${p.dur}s`,
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': p.rot,
            } as React.CSSProperties
          }
        />
      ))}
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
  const MEDAL: Record<number, string> = {
    1: 'var(--play-yellow)',
    2: 'var(--play-silver)',
    3: 'var(--play-orange)',
  };

  /**
   * One accent per row, because ten identical grey pills is a spreadsheet, not
   * a finish. The medals keep the metal they were won in, your row takes the
   * green the game uses for "you" everywhere else, and everyone below third
   * sits on the stage's own violet rather than on flat white/10.
   *
   * The accent tints the row and edges it; it never carries the name or the
   * score. Violet text on a violet row measures 2.5:1 — the type stays stage
   * ink (≥12:1 over every tint here) and the colour does the decorating.
   */
  const accentOf = (rank: number, me: boolean) =>
    MEDAL[rank] ?? (me ? 'var(--play-green)' : 'var(--play-purple)');

  /**
   * Silver is a neutral grey by definition, so tinting second place's row with
   * it produced exactly the flat grey pill this list was built to get rid of.
   * The chip keeps true silver — a medal is a medal — and the row behind it
   * takes a cool steel cast instead, so it reads as metal rather than default.
   */
  const ROW_TINT: Record<number, string> = { 2: '167 190 220' };

  return (
    <div
      className="animate-sheet-up no-scrollbar relative z-10 flex-1 overflow-y-auto px-5 pb-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
    >
      <h1 className="mb-4 font-display text-2xl font-bold tracking-[-0.02em] stage-ink">
        Final results
      </h1>

      {results.mode === 'team_battle' && results.teams && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          {[...results.teams]
            .sort((a, b) => b.teamPoints - a.teamPoints)
            .map((t, i) => (
              <div
                key={t.id}
                className="play-lit-edge relative overflow-hidden rounded-2xl p-3 text-center"
                style={{
                  background: `linear-gradient(160deg, ${
                    i === 0 ? 'rgb(var(--play-yellow) / 0.22)' : 'rgb(255 255 255 / 0.08)'
                  }, rgb(255 255 255 / 0.04))`,
                }}
              >
                <div className="truncate text-[0.65rem] font-black uppercase tracking-[0.12em] stage-soft">
                  {t.name}
                </div>
                <div className="font-display text-2xl font-black tabular-nums stage-ink">
                  {t.teamPoints}
                </div>
                <div className="text-xs stage-faint">{t.individualSum.toLocaleString()} pts</div>
              </div>
            ))}
        </div>
      )}

      <ul className="space-y-2">
        {results.rankings.map((e, i) => {
          const me = e.playerId === mePlayerId;
          const accent = accentOf(e.rank, me);
          const tint = ROW_TINT[e.rank] ?? accent;
          const medal = MEDAL[e.rank];
          return (
            <li
              key={e.playerId}
              // `bg-white/8` was in this spot before and generates no CSS at all
              // in Tailwind (8 isn't on the opacity scale), so every non-you row
              // rendered with no background.
              className="play-panel-in play-lit-edge relative flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5"
              style={{
                animationDelay: `${Math.min(i, 8) * 40}ms`,
                background: `linear-gradient(100deg, rgb(${tint} / ${me ? 0.3 : 0.24}), rgb(${tint} / 0.08) 64%, rgb(255 255 255 / 0.05))`,
                // Your row's green ring lives here rather than in a `ring-2`
                // class: Tailwind's ring IS a box-shadow, so an inline
                // boxShadow on the same element wipes it out.
                boxShadow: me
                  ? 'inset 0 0 0 2px rgb(var(--play-green)), 0 12px 30px -18px rgb(var(--play-green) / 0.85)'
                  : `inset 0 0 0 1px rgb(${tint} / 0.32)`,
              }}
            >
              {/* The metal itself for the top three: a filled chip carrying
                  --play-ink, the same way the risers do on the podium. */}
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-xl font-display text-sm font-black tabular-nums"
                style={
                  medal
                    ? {
                        background: `linear-gradient(160deg, rgb(${medal}), rgb(${medal} / 0.72))`,
                        color: 'rgb(var(--play-ink))',
                        boxShadow: `0 6px 18px -8px rgb(${medal} / 0.9)`,
                      }
                    : { background: 'rgb(255 255 255 / 0.08)', color: 'rgb(var(--stage-ink-soft))' }
                }
              >
                {e.rank}
              </span>
              <Avatar
                image={e.image}
                alt=""
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 text-[0.7rem] font-bold stage-ink"
                style={{ boxShadow: `0 0 0 1.5px rgb(${tint} / 0.55)` }}
              >
                {initials(e.name)}
              </Avatar>
              {winners.has(e.playerId) && (
                <Crown
                  width={16}
                  height={16}
                  className="shrink-0"
                  style={{ color: 'rgb(var(--play-yellow))' }}
                  aria-label="Winner"
                />
              )}
              <span className="min-w-0 flex-1 truncate font-semibold stage-ink">
                {e.name}
                {e.team && <span className="ml-1 text-xs stage-faint">· {e.team}</span>}
              </span>
              {results.mode === 'survival' && e.hearts !== undefined && (
                <Hearts hearts={e.hearts} eliminated={e.isEliminated} size={13} />
              )}
              {/* The score gets its own struck chip rather than trailing the
                  row as plain text — a total you earned should read like it
                  was awarded. Ink stays stage white; the accent is the edge. */}
              <span
                className="shrink-0 rounded-xl px-2 py-1 font-display text-base font-black tabular-nums stage-ink"
                style={{
                  background: 'rgb(0 0 0 / 0.32)',
                  boxShadow: `inset 0 0 0 1px rgb(${tint} / 0.45)`,
                }}
              >
                {e.score.toLocaleString()}
              </span>
            </li>
          );
        })}
      </ul>

      {results.mode === 'survival' &&
        results.eliminationOrder &&
        results.eliminationOrder.length > 0 && (
          <div className="mt-5">
            <h2 className="mb-2 text-xs font-black uppercase tracking-[0.16em] stage-faint">
              Knocked out, in order
            </h2>
            <p className="text-sm stage-soft">
              {results.eliminationOrder.map((p) => p.name).join(' → ')}
            </p>
          </div>
        )}
    </div>
  );
}
