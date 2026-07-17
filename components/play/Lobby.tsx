'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useGameChannel, sendReaction } from '@/lib/play/realtime-client';
import { playSfx, stopSfx } from '@/lib/play/audio';
import { ReactionLayer, EmojiBar, useReactionList } from './Reactions';
import { Avatar as PhotoAvatar } from '@/components/shared/Avatar';
import { Link as LinkIcon, Check, Play } from '@/components/shared/Icons';
import { usePlayActive } from '@/lib/play/use-play-active';
import type { LobbySnapshot, LobbyPlayer, GameMode } from '@/lib/play/types';

const MODE_LABEL: Record<GameMode, string> = {
  classic: 'Classic',
  team_battle: 'Team Battle',
  survival: 'Survival',
};

function initials(name: string): string {
  return name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function Avatar({ name, isGuest, image }: { name: string; isGuest: boolean; image?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <PhotoAvatar
        image={image}
        alt={name}
        className={cn(
          'grid h-14 w-14 place-items-center rounded-2xl text-lg font-bold',
          isGuest ? 'bg-surface-2 text-ink-soft' : 'bg-accent-soft text-accent-ink',
        )}
      >
        {initials(name)}
      </PhotoAvatar>
      <span className="max-w-[4.5rem] truncate text-xs font-semibold text-ink-soft">{name}</span>
      {isGuest && <span className="chip bg-surface-2 text-ink-faint">Guest</span>}
    </div>
  );
}

export function Lobby({ initial }: { initial: LobbySnapshot }) {
  usePlayActive();
  const router = useRouter();
  const [snap, setSnap] = useState(initial);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const { floats, spawn } = useReactionList();
  const sessionId = initial.session.id;

  const refetch = useCallback(async () => {
    try {
      const next = await apiFetch<LobbySnapshot>(`/api/play/sessions/${sessionId}`);
      setSnap(next);
    } catch {
      /* ignore */
    }
  }, [sessionId]);

  // Realtime: roster changes, game-start countdown, reactions.
  useGameChannel(sessionId, (e) => {
    if (e.type === 'LOBBY_UPDATE') refetch();
    else if (e.type === 'GAME_STARTING') {
      stopSfx('lobby-music');
      playSfx('game-start');
      setCountdown(e.countdown);
    } else if (e.type === 'REACTION') spawn(e.emoji);
  });

  // Lobby music loops while waiting (best-effort; browsers may gate autoplay
  // until the first tap, which has usually happened by the lobby).
  useEffect(() => {
    playSfx('lobby-music', { loop: true, volume: 0.5 });
    return () => stopSfx('lobby-music');
  }, []);

  // Poll fallback so the roster stays correct even if a broadcast is missed.
  useEffect(() => {
    const t = setInterval(refetch, 4000);
    return () => clearInterval(t);
  }, [refetch]);

  // Countdown → into the live game.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      router.push(`/play/session/${sessionId}/play`);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, router, sessionId]);

  const { isHost, players, session, mePlayerId } = snap;
  const isTeam = session.mode === 'team_battle';
  const teamNames = session.teamNames;

  const copyLink = () => {
    if (!session.guestToken) return;
    const url = `${window.location.origin}/play/join/${session.guestToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const saveTeams = async (assignments: Record<string, string>) => {
    try {
      await apiFetch(`/api/play/sessions/${sessionId}/teams`, {
        method: 'POST',
        body: JSON.stringify({ assignments }),
      });
    } catch {
      /* ignore */
    }
  };

  const movePlayer = (p: LobbyPlayer) => {
    if (!isHost || !isTeam || !teamNames) return;
    const next = p.team === teamNames[0] ? teamNames[1] : teamNames[0];
    setSnap((s) => ({ ...s, players: s.players.map((x) => (x.id === p.id ? { ...x, team: next } : x)) }));
    saveTeams({ [p.id]: next });
  };

  const randomize = () => {
    if (!teamNames) return;
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const assignments: Record<string, string> = {};
    shuffled.forEach((p, i) => {
      assignments[p.id] = teamNames[i % 2]; // larger team gets the extra on odd counts
    });
    setSnap((s) => ({ ...s, players: s.players.map((x) => ({ ...x, team: assignments[x.id] })) }));
    saveTeams(assignments);
  };

  const startGame = async () => {
    setStarting(true);
    try {
      await apiFetch(`/api/play/sessions/${sessionId}/start`, { method: 'POST' });
    } catch {
      setStarting(false);
    }
  };

  const leave = async () => {
    if (isHost) {
      await apiFetch('/api/play/end-game', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }
    router.push('/play');
  };

  return (
    <div className="app-shell relative overflow-hidden">
      <div className="play-home-bg" />
      <div className="play-bg" />

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink/80">
          <div key={countdown} className="play-count font-display text-[8rem] font-bold text-white">
            {countdown > 0 ? countdown : 'Go!'}
          </div>
        </div>
      )}

      <header
        className="relative z-10 flex items-center justify-between px-5 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.6rem)' }}
      >
        <div>
          <div className="eyebrow">{MODE_LABEL[session.mode]}</div>
          <h1 className="font-display text-xl font-semibold">{session.packName}</h1>
        </div>
        <button type="button" onClick={leave} className="btn-ghost px-3 py-2 text-sm">
          {isHost ? 'Cancel' : 'Leave'}
        </button>
      </header>

      <main className="no-scrollbar relative z-10 flex-1 space-y-6 overflow-y-auto px-5 pb-6">
        {!isHost && (
          <div
            className="relative overflow-hidden rounded-3xl p-6 text-center text-white shadow-pop"
            style={{
              backgroundImage: 'url(/play/join-game-icon.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="animate-breathe font-display text-lg font-semibold drop-shadow">
              Waiting for host to start…
            </div>
            <div className="mt-1 text-xs font-bold uppercase tracking-wide text-white/75 drop-shadow">
              {players.length} players
            </div>
          </div>
        )}

        {/* Guest link */}
        {isHost && session.guestToken && (
          <button
            type="button"
            onClick={copyLink}
            className="card flex w-full items-center gap-3 p-4 text-left"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-soft">
              {copied ? <Check width={16} height={16} /> : <LinkIcon width={16} height={16} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{copied ? 'Link copied!' : 'Share guest link'}</div>
              <div className="truncate text-xs text-ink-faint">/play/join/{session.guestToken}</div>
            </div>
          </button>
        )}

        {/* Roster */}
        {isTeam && teamNames ? (
          <div className="space-y-4">
            {isHost && (
              <button type="button" onClick={randomize} className="btn-ghost w-full">
                Randomize teams
              </button>
            )}
            {teamNames.map((tn) => (
              <section key={tn} className="space-y-3">
                <h2 className="eyebrow">{tn}</h2>
                <div className="grid grid-cols-4 gap-3">
                  {players.filter((p) => p.team === tn).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => movePlayer(p)}
                      disabled={!isHost}
                      className={cn(isHost && 'transition active:scale-95')}
                    >
                      <Avatar name={p.name} isGuest={p.isGuest} image={p.image} />
                    </button>
                  ))}
                </div>
              </section>
            ))}
            {players.some((p) => !p.team) && (
              <section className="space-y-3">
                <h2 className="eyebrow text-warn">Unassigned</h2>
                <div className="grid grid-cols-4 gap-3">
                  {players.filter((p) => !p.team).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => movePlayer(p)}
                      disabled={!isHost}
                      className={cn(isHost && 'transition active:scale-95')}
                    >
                      <Avatar name={p.name} isGuest={p.isGuest} image={p.image} />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <section className="space-y-3">
            <h2 className="eyebrow">Players · {players.length}</h2>
            <div className="grid grid-cols-4 gap-3">
              {players.map((p) => (
                <Avatar key={p.id} name={p.name} isGuest={p.isGuest} image={p.image} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <div
        className="border-t border-line bg-app/95 px-5 pt-3 backdrop-blur"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {isHost ? (
          <button
            type="button"
            onClick={startGame}
            disabled={players.length < 2 || starting}
            className="btn-primary w-full disabled:opacity-50"
          >
            <Play width={16} height={16} />
            {players.length < 2 ? 'Need 2+ players' : 'Start Game'}
          </button>
        ) : (
          <EmojiBar onPick={(e) => mePlayerId && sendReaction(sessionId, e, mePlayerId)} />
        )}
      </div>

      <ReactionLayer floats={floats} />
    </div>
  );
}
