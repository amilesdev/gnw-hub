'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { ChevronLeft, Play, Sparkle } from '@/components/shared/Icons';
import { MIN_QUESTIONS_TO_PLAY } from '@/lib/play/validation';
import { usePlayActive } from '@/lib/play/use-play-active';
import type { GameMode } from '@/lib/play/types';

export interface SetupPack {
  id: string;
  name: string;
  questionCount: number;
}

const MODES: { id: GameMode; name: string; desc: string; color: string; image: string }[] = [
  { id: 'classic', name: 'Classic', desc: 'Fastest correct answers climb the leaderboard.', color: '--play-blue', image: '/play/classic-mode-icon.png' },
  { id: 'team_battle', name: 'Team Battle', desc: 'Two teams, points per round. Sweep a round for a bonus.', color: '--play-purple', image: '/play/team-battle-icon.png' },
  { id: 'survival', name: 'Survival', desc: '3 hearts. Wrong or slowest loses one. Last standing wins.', color: '--play-pink', image: '/play/survival-mode-icon.png' },
];

export function GameSetup({ packs }: { packs: SetupPack[] }) {
  usePlayActive();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [packId, setPackId] = useState<string | null>(null);
  const [mode, setMode] = useState<GameMode>('classic');
  const [seconds, setSeconds] = useState(15);
  const [shuffle, setShuffle] = useState(false);
  const [teamA, setTeamA] = useState('Team 1');
  const [teamB, setTeamB] = useState('Team 2');
  const [guestAccess, setGuestAccess] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPack = packs.find((p) => p.id === packId) ?? null;

  const launch = async (quick: boolean) => {
    if (!packId || launching) return;
    setLaunching(true);
    setError(null);
    const useMode: GameMode = quick ? 'classic' : mode;
    try {
      const { id } = await apiFetch<{ id: string }>('/api/play/sessions', {
        method: 'POST',
        body: JSON.stringify({
          packId,
          mode: useMode,
          settings: {
            time_per_question: quick ? 15 : seconds,
            shuffle: quick ? false : shuffle,
            ...(useMode === 'team_battle' ? { team_names: [teamA.trim() || 'Team 1', teamB.trim() || 'Team 2'] } : {}),
          },
          guestAccess: quick ? false : guestAccess,
        }),
      });
      router.push(`/play/session/${id}/lobby`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the game');
      setLaunching(false);
    }
  };

  return (
    <div className="app-shell play-surface">
      <header
        className="flex items-center gap-3 px-5 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.6rem)' }}
      >
        <button
          type="button"
          onClick={() => (step === 1 ? router.push('/play') : setStep(step - 1))}
          className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-soft"
          aria-label="Back"
        >
          <ChevronLeft width={18} height={18} />
        </button>
        <h1 className="font-display text-xl font-semibold">Start a game</h1>
        <span className="ml-auto text-xs font-semibold text-ink-faint">Step {step} / 3</span>
      </header>

      <main className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-5 pb-28">
        {step === 1 && (
          <>
            <h2 className="eyebrow mb-1">Choose a pack</h2>
            {packs.length === 0 && (
              <div className="card p-6 text-center text-ink-faint">
                No packs yet. <Link href="/play" className="font-semibold text-accent-ink">Create one first.</Link>
              </div>
            )}
            {packs.map((p) => {
              const ok = p.questionCount >= MIN_QUESTIONS_TO_PLAY;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!ok}
                  onClick={() => {
                    setPackId(p.id);
                    setStep(2);
                  }}
                  className={cn(
                    'card flex w-full items-center justify-between p-4 text-left transition',
                    ok ? 'row-press' : 'opacity-50',
                    packId === p.id && 'ring-2 ring-accent',
                  )}
                >
                  <div>
                    <div className="font-semibold text-ink">{p.name}</div>
                    <div className="mt-0.5 text-xs text-ink-faint">
                      {p.questionCount} questions{!ok && ` · need ${MIN_QUESTIONS_TO_PLAY}+`}
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="eyebrow mb-1">Choose a mode</h2>
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMode(m.id);
                  setStep(3);
                }}
                className="play-press flex w-full items-center gap-4 overflow-hidden rounded-3xl p-4 text-left text-white shadow-pop"
                style={{ background: `linear-gradient(135deg, rgb(var(${m.color})), rgb(var(${m.color}) / 0.78))` }}
              >
                <img
                  src={m.image}
                  alt=""
                  width={48}
                  height={48}
                  className="h-12 w-12 shrink-0 rounded-2xl object-cover"
                />
                <span className="min-w-0">
                  <span className="block font-display text-lg font-bold">{m.name}</span>
                  <span className="block text-sm text-white/85">{m.desc}</span>
                </span>
              </button>
            ))}
          </>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h2 className="eyebrow">Customize</h2>

            <div className="card p-4">
              <div className="label mb-2">Time per question</div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSeconds((s) => Math.max(5, s - 5))}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-xl font-bold text-ink-soft"
                >
                  −
                </button>
                <span className="font-display text-2xl font-bold">{seconds}s</span>
                <button
                  type="button"
                  onClick={() => setSeconds((s) => Math.min(60, s + 5))}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-xl font-bold text-ink-soft"
                >
                  +
                </button>
              </div>
            </div>

            <Toggle label="Shuffle questions" on={shuffle} onChange={setShuffle} />

            {mode === 'team_battle' && (
              <div className="card space-y-3 p-4">
                <div className="label">Team names</div>
                <input className="field" value={teamA} onChange={(e) => setTeamA(e.target.value)} placeholder="Team 1" />
                <input className="field" value={teamB} onChange={(e) => setTeamB(e.target.value)} placeholder="Team 2" />
              </div>
            )}

            <Toggle
              label="Allow guest players"
              hint="Share a join link with people outside Hub. Link appears in the lobby."
              on={guestAccess}
              onChange={setGuestAccess}
            />

            {error && <p className="text-sm font-medium text-bad">{error}</p>}
          </div>
        )}
      </main>

      {/* Sticky footer actions */}
      {packId && (
        <div
          className="border-t border-line bg-app/95 px-5 pt-3 backdrop-blur"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => launch(true)}
              disabled={launching}
              className="btn-ghost flex-1 py-3.5 disabled:opacity-50"
            >
              <Sparkle width={16} height={16} /> Quick Start
            </button>
            {step === 3 && (
              <button
                type="button"
                onClick={() => launch(false)}
                disabled={launching}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                <Play width={16} height={16} /> Launch
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="card flex w-full items-center justify-between p-4 text-left"
    >
      <div className="pr-3">
        <div className="font-semibold text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-ink-faint">{hint}</div>}
      </div>
      <span
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          on ? 'bg-accent' : 'bg-surface-2',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
            on ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}
