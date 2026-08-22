'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useGameChannel, sendReaction } from '@/lib/play/realtime-client';
import { playSfx, preloadSfx, startLobbyMusic, stopLobbyMusic } from '@/lib/play/audio';
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

/**
 * The countdown contract, shared with `public/sounds/game-start.mp3`.
 *
 * Each entry is the time, in seconds from the first sample of the file, at
 * which that numeral appears — counting down, so [0, 1, 2] means "3" at 0.000,
 * "2" at 1.000, "1" at 2.000. Spacing does NOT have to be even: an accelerating
 * countdown just means tighter numbers here. This array is the source of truth
 * for what's on screen; the server's `countdown` value only says "start now".
 *
 * Retune these to match whatever the file actually does and the visuals follow.
 * See Docs/GNW-Play-Audio-Manifest.md.
 */
// Measured off the decoded waveform of the shipped file, not assumed. The hits
// were authored at exactly 0/1/2/3 — spacing measures 1.002/1.004/0.978s — but
// the MP3 carries ~26ms of encoder padding at the head and no LAME/Xing gapless
// header telling the decoder to strip it, so every transient sounds 26ms later
// than its nominal time. These are the real attack points.
//
// RE-EXPORTING THE FILE? Re-measure. An encoder that writes a gapless header
// (or a different codec) strips that padding, and these numbers would then run
// 26ms early instead of on time.
const COUNT_BEATS_S = [0.026, 1.025, 2.026];
const GO_AT_S = 3.031;   // the final hit — "Go" lands here
const GO_DWELL_S = 0.9;  // how long "Go" holds before the question screen
// Longest we'll wait for playback to actually begin before counting down
// without it. Preloading means this is normally ~0.
const START_GRACE_MS = 700;

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
  // null = not counting. A number = that numeral is on screen. 0 = "Go".
  const [countdown, setCountdown] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const { floats, spawn } = useReactionList();
  const sessionId = initial.session.id;
  const launching = useRef(false);
  const cancelCountdown = useRef<(() => void) | null>(null);

  const refetch = useCallback(async () => {
    try {
      const next = await apiFetch<LobbySnapshot>(`/api/play/sessions/${sessionId}`);
      // Only adopt a response that is actually a lobby snapshot. Anything else
      // — a truncated body, an edge/proxy error page rendered as JSON — would
      // otherwise replace good state with junk and the next render would read
      // `session.mode` off undefined and take the whole screen down.
      if (next && typeof next === 'object' && next.session) setSnap(next);
    } catch {
      /* ignore */
    }
  }, [sessionId]);

  /**
   * The 3-2-1, driven by the audio playhead rather than by a timer.
   *
   * The numbers read their beat out of `game-start.mp3`'s own `currentTime`, so
   * however long the file took to buffer, "3" lands on the first hit and "Go"
   * lands on the last one. Three things used to guarantee it drifted: the file
   * wasn't preloaded (100–500ms of buffering after the numbers had already
   * started), a chain of `setTimeout(1000)` accumulated its own lag, and the
   * screen navigated away the instant it hit zero — so "Go" got no screen time
   * at all and its hit would have played over the question screen.
   *
   * If the audio is blocked (autoplay policy) or the file is missing, the wall
   * clock takes over at the same tempo and nothing looks different.
   */
  const runCountdown = useCallback(() => {
    if (launching.current) return;
    launching.current = true;

    stopLobbyMusic();
    const el = playSfx('game-start');

    let startedAt = performance.now();
    const endsAt = GO_AT_S + GO_DWELL_S;
    let raf = 0;

    const tick = () => {
      // Prefer the playhead; fall back to the wall clock until it advances.
      const audioT = el && !el.paused && el.currentTime > 0 ? el.currentTime : null;
      const wallT = (performance.now() - startedAt) / 1000;
      const t = audioT ?? wallT;

      // A stalled or looping audio element must never strand everyone in the
      // lobby, so the wall clock can always end the countdown on its own.
      if (t >= endsAt || wallT >= endsAt + 2) {
        router.push(`/play/session/${sessionId}/play`);
        return;
      }

      // The last beat whose time has passed. 0 → "Go".
      let shown = COUNT_BEATS_S.length;
      if (t >= GO_AT_S) shown = 0;
      else for (let i = 0; i < COUNT_BEATS_S.length; i++) {
        if (t >= COUNT_BEATS_S[i]) shown = COUNT_BEATS_S.length - i;
      }
      setCountdown(shown);

      raf = requestAnimationFrame(tick);
    };

    // Start the numbers when the sound actually starts, not when we asked it
    // to. Otherwise a slow buffer leaves "3" sitting on screen while the file
    // catches up — measured at 1.9s on a cold, throttled load. The lobby simply
    // stays up for that fraction of a second instead, which reads as nothing at
    // all. START_GRACE_MS caps the wait so a blocked or missing file still
    // counts down, just on the wall clock.
    let begun = false;
    const begin = () => {
      if (begun) return;
      begun = true;
      clearTimeout(graceTimer);
      el?.removeEventListener('playing', begin);
      el?.removeEventListener('error', begin);
      startedAt = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const graceTimer = setTimeout(begin, START_GRACE_MS);
    if (el) {
      el.addEventListener('playing', begin, { once: true });
      el.addEventListener('error', begin, { once: true });
    } else {
      begin();
    }

    cancelCountdown.current = () => {
      clearTimeout(graceTimer);
      cancelAnimationFrame(raf);
    };
  }, [router, sessionId]);

  // Realtime: roster changes, game-start countdown, reactions.
  useGameChannel(sessionId, (e) => {
    if (e.type === 'LOBBY_UPDATE') refetch();
    else if (e.type === 'GAME_STARTING') runCountdown();
    else if (e.type === 'REACTION') spawn(e.emoji);
  });

  // Lobby music plays the whole time people are waiting: the lobby-music tracks
  // in random order, crossfading into one another so there's no silence between
  // them (best-effort; browsers may gate autoplay until the first tap, which has
  // usually happened by the lobby — the player retries on it either way). The
  // countdown cue is fetched now, while there's time, rather than at the instant
  // it has to be in sync with something.
  useEffect(() => {
    startLobbyMusic(0.5);
    preloadSfx('game-start');
    return () => {
      stopLobbyMusic();
      cancelCountdown.current?.();
    };
  }, []);

  // Poll fallback so the roster stays correct even if a broadcast is missed.
  useEffect(() => {
    const t = setInterval(refetch, 4000);
    return () => clearInterval(t);
  }, [refetch]);

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
      <div className="play-bg" />

      {/* Countdown — the house lights going down. This paints the same stage
          ground the live game does, so the hand-off into the question screen is
          a continuous room rather than a cut to a different one. */}
      {countdown !== null && (
        <div className="play-stage absolute inset-0 z-50 flex items-center justify-center">
          <span
            aria-hidden
            className="pointer-events-none absolute h-72 w-72 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgb(var(--play-beam) / 0.22), transparent 68%)',
              filter: 'blur(24px)',
            }}
          />
          <div
            key={countdown}
            className="play-count relative font-display text-[7.5rem] font-black leading-none tabular-nums stage-ink"
          >
            {countdown > 0 ? countdown : 'Go'}
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
            className="play-panel play-panel-lit play-lit-edge flex items-center gap-3 p-6"
            style={{ ['--tint' as string]: 'var(--play-green)' }}
          >
            {/* Same panel material as the home screen: art bounded to the right
                and faded out, text on the solid tint. The old version ran the
                photo full-bleed under a 45% scrim, which is what made the home
                and lobby read as two different products. */}
            <span
              className="play-panel-art"
              style={{ backgroundImage: 'url(/play/join-game-icon.png)' }}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="animate-breathe block font-display text-xl font-bold leading-tight">
                Waiting on the host
              </span>
              <span className="mt-1.5 block text-[0.65rem] font-black uppercase tracking-[0.14em] text-play-ink/75">
                {players.length} {players.length === 1 ? 'player' : 'players'} in
              </span>
            </span>
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
