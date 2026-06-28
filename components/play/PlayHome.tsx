'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Plus, Play, ChevronRight, ChevronLeft } from '@/components/shared/Icons';
import { PlayModal, PlayConfirm } from './PlayModal';
import { EnterGate } from './EnterGate';
import { usePlayActive } from '@/lib/play/use-play-active';
import { MIN_QUESTIONS_TO_PLAY } from '@/lib/play/validation';
import type { GameMode } from '@/lib/play/types';
import type { PlayPointsRow } from '@/lib/play/queries';

export interface PackSummary {
  id: string;
  name: string;
  questionCount: number;
  updatedAt: string;
}

export interface ActiveGame {
  sessionId: string;
  mode: GameMode;
  status: 'lobby' | 'active';
  packName: string;
  playerCount: number;
  isHost: boolean;
}

const MODE_LABEL: Record<GameMode, string> = {
  classic: 'Classic',
  team_battle: 'Team Battle',
  survival: 'Survival',
};

// Fun palette cycled across pack cards.
const PACK_COLORS = ['--play-purple', '--play-blue', '--play-pink', '--play-orange', '--play-green'];

// Tailwind colors for the top-three rank numbers on the leaderboard.
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

// Module-scoped so it survives client-side navigation within Play: once the
// player has crossed the Enter gate, returning to /play (from a pack, setup,
// lobby, results…) lands straight on this home — not back at the gate. Only the
// real "back to Hub" button (below) resets it; a full reload also resets it.
let hasEnteredPlay = false;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function PlayHome({
  role,
  firstName,
  playPoints,
  packs,
  activeGame,
  leaderboard,
  currentUserId,
}: {
  role: 'leader' | 'member';
  firstName: string;
  playPoints: number;
  packs: PackSummary[];
  activeGame: ActiveGame | null;
  leaderboard: PlayPointsRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const backHref = role === 'leader' ? '/dashboard' : '/home';

  const [entered, setEntered] = useState(hasEnteredPlay);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [deletePack, setDeletePack] = useState<PackSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Keep the native grain until the player crosses into game mode.
  usePlayActive(entered);

  const createPack = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const { id } = await apiFetch<{ id: string }>('/api/play/packs', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      });
      router.push(`/play/packs/${id}/edit`);
    } catch {
      setCreating(false);
    }
  };

  const duplicatePack = async (id: string) => {
    setManageOpen(false);
    try {
      const res = await apiFetch<{ id: string }>(`/api/play/packs/${id}/duplicate`, { method: 'POST' });
      router.push(`/play/packs/${res.id}/edit`);
    } catch {
      /* ignore */
    }
  };

  const confirmDelete = async () => {
    if (!deletePack) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await apiFetch(`/api/play/packs/${deletePack.id}`, { method: 'DELETE' });
      setDeletePack(null);
      router.refresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete this pack');
    } finally {
      setBusy(false);
    }
  };

  const joinGame = () => {
    if (activeGame?.status === 'lobby') router.push(`/play/session/${activeGame.sessionId}/lobby`);
  };

  // A leader who isn't hosting the current game can join it like any player.
  const canJoinAsLeader = activeGame?.status === 'lobby' && !activeGame.isHost;

  if (!entered)
    return (
      <EnterGate
        variant={role}
        onEnter={() => {
          hasEnteredPlay = true;
          setEntered(true);
        }}
      />
    );

  return (
    <div className="app-shell relative overflow-hidden">
      <div className="play-home-bg" />
      <div className="play-bg" />

      <header
        className="relative z-10 flex items-center gap-3 px-5 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.6rem)' }}
      >
        <button
          type="button"
          onClick={() => {
            // The one and only exit out of Play, back to the Hub.
            hasEnteredPlay = false;
            router.push(backHref);
          }}
          className="play-press grid h-9 w-9 place-items-center rounded-full bg-surface/80 text-ink-soft backdrop-blur"
          aria-label="Back to Hub"
        >
          <ChevronLeft width={18} height={18} />
        </button>
        <div className="text-sm font-extrabold uppercase tracking-[0.18em] text-ink-faint">GNW Play</div>
      </header>

      <main className="play-home-in no-scrollbar relative z-10 flex-1 space-y-5 overflow-y-auto px-5 pb-8">
        <h1 className="page-title pt-1">Hey {firstName}</h1>

        {/* Host rejoin banner */}
        {activeGame?.isHost && (
          <button
            type="button"
            onClick={() =>
              router.push(
                activeGame.status === 'lobby'
                  ? `/play/session/${activeGame.sessionId}/lobby`
                  : `/play/session/${activeGame.sessionId}/play`,
              )
            }
            className="play-press relative w-full overflow-hidden rounded-3xl p-5 text-left text-white shadow-pop"
            style={{ background: 'linear-gradient(135deg, rgb(var(--play-purple)), rgb(var(--play-blue)))' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-white/75">
                  {MODE_LABEL[activeGame.mode]} · {activeGame.playerCount} players
                </div>
                <div className="mt-1 font-display text-lg font-semibold">{activeGame.packName}</div>
                <div className="mt-0.5 text-sm text-white/85">Rejoin as host →</div>
              </div>
              <ChevronRight width={24} height={24} />
            </div>
          </button>
        )}

        {role === 'leader' ? (
          <>
            {/* When another leader is hosting, this leader can join as a player. */}
            {canJoinAsLeader && <JoinGameButton activeGame={activeGame} onJoin={joinGame} />}

            <div className="grid grid-cols-2 gap-3">
              <ActionTile
                color="--play-purple"
                icon={<Plus width={24} height={24} />}
                label="Create Pack"
                image="/play/create-pack.webp"
                onClick={() => setCreateOpen(true)}
              />
              <ActionTile
                color="--play-green"
                icon={<Play width={22} height={22} />}
                label="Start Game"
                image="/play/start-game.webp"
                onClick={() => router.push('/play/setup')}
              />
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-soft">My packs</h2>
                {packs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setManageOpen(true)}
                    className="play-press grid h-8 w-8 place-items-center rounded-full bg-surface/85 text-lg leading-none text-ink-soft shadow-card backdrop-blur"
                    aria-label="Manage packs"
                  >
                    ⋯
                  </button>
                )}
              </div>
              {packs.length === 0 ? (
                <div className="rounded-3xl bg-surface/80 p-6 text-center text-ink-faint backdrop-blur">
                  No packs yet. Create your first one.
                </div>
              ) : (
                packs.map((p, i) => {
                  const color = PACK_COLORS[i % PACK_COLORS.length];
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => router.push(`/play/packs/${p.id}/edit`)}
                      className="play-press relative flex w-full items-center gap-3 rounded-2xl bg-surface/85 p-3.5 text-left shadow-card backdrop-blur"
                    >
                      <span
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white"
                        style={{ background: `rgb(var(${color}))` }}
                      >
                        <Play width={20} height={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-ink">{p.name}</span>
                        <span className="mt-0.5 block text-xs text-ink-faint">
                          {p.questionCount} {p.questionCount === 1 ? 'question' : 'questions'}
                          {p.questionCount < MIN_QUESTIONS_TO_PLAY && (
                            <span className="text-warn"> · need {MIN_QUESTIONS_TO_PLAY}+</span>
                          )}{' '}
                          · {relativeTime(p.updatedAt)}
                        </span>
                      </span>
                      <ChevronRight width={18} height={18} className="shrink-0 text-ink-faint" />
                    </button>
                  );
                })
              )}
            </section>

            <AllTimeWins playPoints={playPoints} />
          </>
        ) : (
          <>
            <JoinGameButton activeGame={activeGame} onJoin={joinGame} />
            <AllTimeWins playPoints={playPoints} />
          </>
        )}

        <section className="space-y-2">
          <div className="flex items-center gap-3">
            <img
              src="/play/leaderboard-icon.png"
              alt=""
              aria-hidden
              className="h-9 w-9 rounded-xl object-cover"
            />
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-soft">Leaderboard</h2>
          </div>

          {leaderboard.length === 0 || leaderboard.every((r) => r.playPoints === 0) ? (
            <div className="rounded-3xl bg-surface/80 p-6 text-center text-ink-faint backdrop-blur">
              No wins recorded yet. Play a game!
            </div>
          ) : (
            leaderboard.map((r) => {
              const me = r.id === currentUserId;
              return (
                <div
                  key={r.id}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl bg-surface/85 p-3.5 shadow-card backdrop-blur',
                    me && 'ring-2 ring-accent',
                  )}
                >
                  <div
                    className={cn(
                      'w-7 text-center font-display text-lg font-bold',
                      MEDAL[r.rank] ?? 'text-ink-faint',
                    )}
                  >
                    {r.rank}
                  </div>
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-bold text-ink-soft">
                    {initials(r.name)}
                  </div>
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
        </section>
      </main>

      {/* Create pack modal */}
      <PlayModal open={createOpen} onClose={() => setCreateOpen(false)} title="New pack">
        <input
          autoFocus
          className="field"
          placeholder="Pack name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createPack()}
        />
        <div className="mt-5 flex gap-3">
          <button type="button" className="btn-ghost flex-1" onClick={() => setCreateOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary flex-1 disabled:opacity-50"
            onClick={createPack}
            disabled={!newName.trim() || creating}
          >
            Create
          </button>
        </div>
      </PlayModal>

      {/* Manage packs — edit / duplicate / delete every pack in one place. */}
      <PlayModal open={manageOpen} onClose={() => setManageOpen(false)} title="Manage packs">
        <div className="space-y-3">
          {packs.map((p, i) => {
            const color = PACK_COLORS[i % PACK_COLORS.length];
            return (
              <div key={p.id} className="rounded-2xl bg-surface/85 p-3.5 shadow-card backdrop-blur">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white"
                    style={{ background: `rgb(var(${color}))` }}
                  >
                    <Play width={18} height={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-ink">{p.name}</div>
                    <div className="mt-0.5 text-xs text-ink-faint">
                      {p.questionCount} {p.questionCount === 1 ? 'question' : 'questions'} · {relativeTime(p.updatedAt)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="play-press flex-1 rounded-xl bg-surface-2 px-3 py-2 text-sm font-bold text-ink"
                    onClick={() => {
                      setManageOpen(false);
                      router.push(`/play/packs/${p.id}/edit`);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="play-press flex-1 rounded-xl bg-surface-2 px-3 py-2 text-sm font-bold text-ink"
                    onClick={() => duplicatePack(p.id)}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="play-press flex-1 rounded-xl bg-bad/10 px-3 py-2 text-sm font-bold text-bad"
                    onClick={() => {
                      setManageOpen(false);
                      setDeletePack(p);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </PlayModal>

      <PlayConfirm
        open={deletePack !== null}
        title="Delete pack?"
        message={deletePack ? `Delete "${deletePack.name}"? This cannot be undone.` : ''}
        onConfirm={confirmDelete}
        onClose={() => {
          setDeletePack(null);
          setDeleteError(null);
        }}
        busy={busy}
        error={deleteError}
      />
    </div>
  );
}

// Shared by members and non-hosting leaders. Pulses with an urgent green ring
// while a game is open in the lobby; shows a calm empty state otherwise.
function JoinGameButton({ activeGame, onJoin }: { activeGame: ActiveGame | null; onJoin: () => void }) {
  const live = activeGame?.status === 'lobby';
  return (
    <button
      type="button"
      onClick={onJoin}
      disabled={!live}
      className={cn(
        'play-press relative flex w-full flex-col items-center justify-center overflow-hidden rounded-3xl p-6 text-center shadow-pop',
        live ? 'play-join-pulse' : 'opacity-70',
      )}
      style={
        live
          ? { backgroundImage: 'url(/play/join-game-icon.png)', backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: 'rgb(var(--surface-2))' }
      }
    >
      <div className={cn('font-display text-2xl font-bold drop-shadow', live ? 'text-white' : 'text-ink-faint')}>
        {live ? 'Join Game' : 'No game right now'}
      </div>
      <div
        className={cn(
          'mt-1',
          live ? 'text-xs font-bold uppercase tracking-wide text-white/75 drop-shadow' : 'text-sm text-ink-faint',
        )}
      >
        {live
          ? `${MODE_LABEL[activeGame!.mode]} · ${activeGame!.playerCount} players`
          : 'Check back when your leader starts one.'}
      </div>
    </button>
  );
}

// "All-time wins" trophy card — both members and leaders earn play points.
function AllTimeWins({ playPoints }: { playPoints: number }) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-6 text-center text-white shadow-pop"
      style={{
        backgroundImage: 'url(/play/all-time-wins-icon.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="font-display text-6xl font-extrabold drop-shadow">{playPoints}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-white/85">All-time wins</div>
    </div>
  );
}

function ActionTile({
  color,
  icon,
  label,
  onClick,
  image,
}: {
  color: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  /** Optional background image at `/public/play/<file>` (e.g. '/play/create-pack.png'). */
  image?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="play-press relative flex aspect-[5/4] flex-col items-start justify-between overflow-hidden rounded-3xl p-4 text-left text-white shadow-pop"
      style={
        image
          ? { backgroundImage: `url(${image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: `rgb(var(${color}))` }
      }
    >
      {/* When an art image is provided, darken the bottom so the label stays legible. */}
      {image && (
        <span
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgb(0 0 0 / 0.05) 0%, rgb(0 0 0 / 0.55) 100%)' }}
          aria-hidden
        />
      )}
      <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-white/20 backdrop-blur-sm">{icon}</span>
      <span className="relative font-display text-lg font-bold leading-tight drop-shadow">{label}</span>
    </button>
  );
}
