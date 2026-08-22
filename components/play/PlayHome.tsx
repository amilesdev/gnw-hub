'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  Plus,
  Play,
  ChevronRight,
  ChevronLeft,
  Crown,
  MoreHorizontal,
} from '@/components/shared/Icons';
import { Avatar } from '@/components/shared/Avatar';
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

// Podium metals, matching the results screen — a 1st place here and a 1st place
// on the podium should be the same colour, or the leaderboard is just a list.
//
// Worn as a FILLED chip rather than as coloured digits. Gold and bronze text on
// the light home measured 1.63:1 and 2.04:1 — the top three ranks were the
// least readable numbers on the screen. Inverted, the same colours carry
// --play-ink at 11.2:1 and 8.98:1, and a filled medal reads more like a medal
// anyway. (The stage screens keep coloured digits: on the near-black ground
// those same metals clear 9:1 unaided.)
const MEDAL: Record<number, string> = {
  1: 'var(--play-yellow)',
  2: 'var(--play-silver)',
  3: 'var(--play-orange)',
};

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
          className="play-press grid h-10 w-10 place-items-center rounded-full bg-surface/80 text-ink-soft backdrop-blur"
          aria-label="Back to Hub"
        >
          <ChevronLeft width={18} height={18} />
        </button>
        <div className="text-sm font-extrabold uppercase tracking-[0.18em] text-ink-faint">GNW Play</div>
      </header>

      <main className="play-home-in no-scrollbar relative z-10 flex-1 space-y-5 overflow-y-auto px-5 pb-8">
        <h1 className="page-title pt-1">Hey {firstName}</h1>

        {/* Host rejoin — the loudest thing on the screen when it applies,
            because a host with a game open has exactly one job. */}
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
            className="play-panel play-panel-lit play-lit-edge play-press play-join-pulse flex w-full items-center gap-3 p-5 text-left"
            style={{ ['--tint' as string]: 'var(--play-green)' }}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[0.65rem] font-black uppercase tracking-[0.14em] text-play-ink/70">
                {MODE_LABEL[activeGame.mode]} · {activeGame.playerCount}{' '}
                {activeGame.playerCount === 1 ? 'player' : 'players'}
              </span>
              <span className="mt-1 block truncate font-display text-xl font-bold">
                {activeGame.packName}
              </span>
              <span className="mt-0.5 block text-sm font-semibold text-play-ink/85">
                Rejoin as host
              </span>
            </span>
            <ChevronRight width={22} height={22} className="shrink-0" />
          </button>
        )}

        {role === 'leader' ? (
          <>
            {/* When another leader is hosting, this leader can join as a player. */}
            {canJoinAsLeader && <JoinGameButton activeGame={activeGame} onJoin={joinGame} />}

            <div className="grid grid-cols-2 gap-3">
              <ActionTile
                tint="--play-purple"
                icon={<Plus width={22} height={22} />}
                label="Create pack"
                art="/play/create-pack.webp"
                onClick={() => setCreateOpen(true)}
              />
              <ActionTile
                tint="--play-blue"
                icon={<Play width={20} height={20} />}
                label="Start game"
                art="/play/start-game.webp"
                onClick={() => router.push('/play/setup')}
              />
            </div>

            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="eyebrow">My packs</h2>
                {packs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setManageOpen(true)}
                    className="play-press grid h-10 w-10 place-items-center rounded-full bg-surface/85 text-ink-soft shadow-card backdrop-blur"
                    aria-label="Manage packs"
                  >
                    <MoreHorizontal width={18} height={18} />
                  </button>
                )}
              </div>
              {packs.length === 0 ? (
                <div className="play-panel p-6 text-center text-sm text-ink-faint">
                  No packs yet. Create your first one and it shows up here.
                </div>
              ) : (
                packs.map((p) => <PackRow key={p.id} pack={p} onOpen={() => router.push(`/play/packs/${p.id}/edit`)} />)
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

        <section className="space-y-2.5">
          <h2 className="eyebrow">All-time leaderboard</h2>

          {leaderboard.length === 0 || leaderboard.every((r) => r.playPoints === 0) ? (
            <div className="play-panel p-6 text-center text-sm text-ink-faint">
              Nobody&apos;s won a game yet. Somebody has to go first.
            </div>
          ) : (
            leaderboard.map((r) => {
              const me = r.id === currentUserId;
              const metal = MEDAL[r.rank];
              return (
                <div
                  key={r.id}
                  className={cn(
                    'play-panel flex items-center gap-3 p-3.5',
                    me && 'ring-2 ring-accent',
                  )}
                >
                  {metal ? (
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg font-display text-sm font-black tabular-nums text-play-ink"
                      style={{ background: `rgb(${metal})` }}
                    >
                      {r.rank}
                    </span>
                  ) : (
                    <span className="w-7 shrink-0 text-center font-display text-base font-black tabular-nums text-ink-soft">
                      {r.rank}
                    </span>
                  )}
                  <Avatar
                    image={r.image}
                    alt=""
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-bold text-ink-soft"
                  >
                    {initials(r.name)}
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="min-w-0 truncate font-semibold text-ink">{r.name}</span>
                      {me && (
                        <span className="shrink-0 text-[0.6rem] font-black uppercase tracking-wider text-ink-faint">
                          you
                        </span>
                      )}
                    </span>
                  </span>
                  {r.rank === 1 && (
                    <Crown
                      width={16}
                      height={16}
                      className="shrink-0"
                      style={{ color: 'rgb(var(--play-yellow))' }}
                      aria-label="Leading"
                    />
                  )}
                  <span className="shrink-0 text-right">
                    <span className="font-display text-lg font-black tabular-nums text-ink">
                      {r.playPoints}
                    </span>
                    <span className="ml-1 text-xs text-ink-faint">
                      {r.playPoints === 1 ? 'win' : 'wins'}
                    </span>
                  </span>
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
          enterKeyHint="go"
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
          {packs.map((p) => (
            <div key={p.id} className="play-panel p-3.5">
              <div className="min-w-0">
                <div className="truncate font-bold text-ink">{p.name}</div>
                <div className="mt-0.5 text-xs text-ink-faint">
                  {p.questionCount} {p.questionCount === 1 ? 'question' : 'questions'} ·{' '}
                  {relativeTime(p.updatedAt)}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="play-press flex-1 rounded-xl bg-surface-2 px-3 py-2.5 text-sm font-bold text-ink"
                  onClick={() => {
                    setManageOpen(false);
                    router.push(`/play/packs/${p.id}/edit`);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="play-press flex-1 rounded-xl bg-surface-2 px-3 py-2.5 text-sm font-bold text-ink"
                  onClick={() => duplicatePack(p.id)}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="play-press flex-1 rounded-xl bg-bad/10 px-3 py-2.5 text-sm font-bold text-bad"
                  onClick={() => {
                    setManageOpen(false);
                    setDeletePack(p);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
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

/**
 * One pack in the library.
 *
 * Rows used to cycle through five play colours by list index, which looked
 * lively and meant nothing — the colour changed when you added a pack above it.
 * The only thing actually true about a pack is whether it's ready to play, so
 * that's what carries the colour now: a lit green chip when it can go, a held
 * back state and a plain count when it can't.
 */
function PackRow({ pack, onOpen }: { pack: PackSummary; onOpen: () => void }) {
  const ready = pack.questionCount >= MIN_QUESTIONS_TO_PLAY;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="play-panel play-press flex w-full items-center gap-3 p-3.5 text-left"
    >
      <span
        className={cn(
          'grid h-11 w-11 shrink-0 place-items-center rounded-2xl',
          ready ? 'text-play-ink' : 'bg-surface-2 text-ink-faint',
        )}
        style={ready ? { background: 'rgb(var(--play-green))' } : undefined}
        aria-hidden
      >
        <Play width={18} height={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold text-ink">{pack.name}</span>
        <span className="mt-0.5 block text-xs text-ink-faint">
          {pack.questionCount} {pack.questionCount === 1 ? 'question' : 'questions'} ·{' '}
          {relativeTime(pack.updatedAt)}
        </span>
      </span>
      {/* Neutral, not amber: `text-warn` (#C58A3D) measures 2.98:1 on the light
          surface and can't pass as small text, and there's no dark-mode-safe
          amber in the system. The held-back play chip already carries the
          state — this just says how far off it is. */}
      {!ready && (
        <span className="chip shrink-0 bg-surface-2 text-ink-soft">
          {MIN_QUESTIONS_TO_PLAY - pack.questionCount} more
        </span>
      )}
      <ChevronRight width={18} height={18} className="shrink-0 text-ink-faint" />
    </button>
  );
}

/**
 * Shared by members and non-hosting leaders. This is the hero of the member's
 * home: the only question that matters when they open Play is whether there's a
 * game to walk into right now.
 */
function JoinGameButton({ activeGame, onJoin }: { activeGame: ActiveGame | null; onJoin: () => void }) {
  const live = activeGame?.status === 'lobby';

  if (!live)
    return (
      <div className="play-panel p-6 text-center">
        <div className="font-display text-lg font-semibold text-ink-soft">No game right now</div>
        <p className="mt-1 text-sm text-ink-faint">
          When your leader starts one, it shows up here.
        </p>
      </div>
    );

  return (
    <button
      type="button"
      onClick={onJoin}
      className="play-panel play-panel-lit play-lit-edge play-press play-join-pulse flex w-full items-center gap-3 p-6 text-left"
      style={{ ['--tint' as string]: 'var(--play-green)' }}
    >
      {/* Art is bounded to the right and fades out before the text — no scrim,
          so the label sits on the solid tint at its audited contrast. */}
      <span className="play-panel-art" style={{ backgroundImage: 'url(/play/join-game-icon.png)' }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-2xl font-bold leading-none">Join game</span>
        <span className="mt-1.5 block text-[0.65rem] font-black uppercase tracking-[0.14em] text-play-ink/75">
          {MODE_LABEL[activeGame!.mode]} · {activeGame!.playerCount}{' '}
          {activeGame!.playerCount === 1 ? 'player' : 'players'} in
        </span>
      </span>
      <ChevronRight width={22} height={22} className="shrink-0" />
    </button>
  );
}

/** The player's trophy shelf. Gold, to match 1st place on the podium. */
function AllTimeWins({ playPoints }: { playPoints: number }) {
  return (
    <div
      className="play-panel play-panel-lit play-lit-edge flex items-center gap-3 p-6"
      style={{ ['--tint' as string]: 'var(--play-yellow)' }}
    >
      <span className="play-panel-art" style={{ backgroundImage: 'url(/play/all-time-wins-icon.png)' }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-5xl font-black leading-none tabular-nums">
          {playPoints}
        </span>
        <span className="mt-1.5 block text-[0.65rem] font-black uppercase tracking-[0.16em] text-play-ink/75">
          All-time wins
        </span>
      </span>
    </div>
  );
}

function ActionTile({
  tint,
  icon,
  label,
  onClick,
  art,
}: {
  tint: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  /** Artwork at `/public/play/<file>`; bounded to the right of the tile. */
  art?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="play-panel play-panel-lit play-lit-edge play-press flex aspect-[5/4] flex-col items-start justify-between p-4 text-left"
      style={{ ['--tint' as string]: `var(${tint})` }}
    >
      {art && <span className="play-panel-art" style={{ backgroundImage: `url(${art})` }} aria-hidden />}
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-play-ink/15">{icon}</span>
      <span className="font-display text-base font-bold leading-tight">{label}</span>
    </button>
  );
}
