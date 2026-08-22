'use client';

// GNW Play — dev-only screen gallery.
//
// Renders the REAL Play components against mock payloads (lib/play/preview-fixtures)
// so every screen and state can be reviewed without a database, a running game,
// or five people in a room. Nothing here is a re-implementation: if a screen
// looks wrong in the gallery, it looks wrong in the game.
//
// Safety: while the gallery is mounted, `window.fetch` is patched to swallow any
// request to `/api/play/*` and return a canned 200. Tapping "Start Game" or
// deleting a question in a preview scene therefore cannot mutate real data.

import { useEffect, useState, type ReactNode } from 'react';
import { EnterGate } from './EnterGate';
import { GameSetup } from './GameSetup';
import { GuestJoin } from './GuestJoin';
import { LiveGame } from './LiveGame';
import { Lobby } from './Lobby';
import { PackBuilder } from './PackBuilder';
import { PackPreview } from './PackPreview';
import { PlayHome } from './PlayHome';
import { PlayLeaderboard } from './PlayLeaderboard';
import { Results } from './Results';
import * as F from '@/lib/play/preview-fixtures';

// ---------------------------------------------------------------------------
// Network guard
// ---------------------------------------------------------------------------

function usePreviewNetworkGuard(): void {
  useEffect(() => {
    const real = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/api/play/')) {
        // eslint-disable-next-line no-console
        console.info('[play-preview] blocked', init?.method ?? 'GET', url);
        return new Response(
          JSON.stringify({ ok: true, preview: true, sessionId: F.PREVIEW_SESSION_ID }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return real(input, init);
    };
    return () => {
      window.fetch = real;
    };
  }, []);
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

interface Scene {
  id: string;
  group: string;
  name: string;
  note?: string;
  render: () => ReactNode;
}

const noop = () => {};

const SCENES: Scene[] = [
  // --- Entry ---------------------------------------------------------------
  {
    id: 'gate-member',
    group: 'Entry',
    name: 'Enter gate — member',
    note: 'The threshold into the game world. Keeps the Hub paper grain until you cross.',
    render: () => <EnterGate variant="member" onEnter={noop} />,
  },
  {
    id: 'gate-leader',
    group: 'Entry',
    name: 'Enter gate — leader',
    render: () => <EnterGate variant="leader" onEnter={noop} />,
  },

  // --- Home ----------------------------------------------------------------
  {
    id: 'home-leader',
    group: 'Home',
    name: 'Play Home — leader',
    note: 'Shows the gate first (same as the real app). Tap Enter once; later Home scenes skip it.',
    render: () => (
      <PlayHome
        role="leader"
        firstName="Alonzo"
        playPoints={5}
        packs={F.PACK_SUMMARIES}
        activeGame={null}
        leaderboard={F.PLAY_POINTS}
        currentUserId={F.ME_USER_ID}
      />
    ),
  },
  {
    id: 'home-leader-empty',
    group: 'Home',
    name: 'Play Home — leader, no packs',
    note: 'Empty state: "No packs yet."',
    render: () => (
      <PlayHome
        role="leader"
        firstName="Alonzo"
        playPoints={0}
        packs={[]}
        activeGame={null}
        leaderboard={F.PLAY_POINTS}
        currentUserId={F.ME_USER_ID}
      />
    ),
  },
  {
    id: 'home-leader-active',
    group: 'Home',
    name: 'Play Home — active game banner',
    note: 'Host has a lobby open — "Rejoin as Host".',
    render: () => (
      <PlayHome
        role="leader"
        firstName="Alonzo"
        playPoints={5}
        packs={F.PACK_SUMMARIES}
        activeGame={F.ACTIVE_GAME_LOBBY}
        leaderboard={F.PLAY_POINTS}
        currentUserId={F.ME_USER_ID}
      />
    ),
  },
  {
    id: 'home-member',
    group: 'Home',
    name: 'Play Home — member, no game',
    note: 'Join button visible but disabled — "No game right now".',
    render: () => (
      <PlayHome
        role="member"
        firstName="Aleena"
        playPoints={7}
        packs={[]}
        activeGame={null}
        leaderboard={F.PLAY_POINTS}
        currentUserId="preview-user-2"
      />
    ),
  },
  {
    id: 'home-member-active',
    group: 'Home',
    name: 'Play Home — member, game open',
    note: 'A lobby is live — the join button is hot.',
    render: () => (
      <PlayHome
        role="member"
        firstName="Aleena"
        playPoints={7}
        packs={[]}
        activeGame={{ ...F.ACTIVE_GAME_LOBBY, isHost: false }}
        leaderboard={F.PLAY_POINTS}
        currentUserId="preview-user-2"
      />
    ),
  },
  {
    id: 'leaderboard',
    group: 'Home',
    name: 'Leaderboard',
    note: 'All-time Play Points. Rank 3 is a tie; your row is highlighted.',
    render: () => <PlayLeaderboard rows={F.PLAY_POINTS} currentUserId={F.ME_USER_ID} />,
  },
  {
    id: 'leaderboard-empty',
    group: 'Home',
    name: 'Leaderboard — empty',
    render: () => <PlayLeaderboard rows={[]} currentUserId={F.ME_USER_ID} />,
  },

  // --- Packs ---------------------------------------------------------------
  {
    id: 'builder',
    group: 'Packs',
    name: 'Pack builder',
    note: '8 questions; the last one is deliberately incomplete to show the badge.',
    render: () => <PackBuilder initialPack={F.PACK_FULL} />,
  },
  {
    id: 'builder-empty',
    group: 'Packs',
    name: 'Pack builder — new pack',
    render: () => <PackBuilder initialPack={F.PACK_EMPTY} />,
  },
  {
    id: 'builder-locked',
    group: 'Packs',
    name: 'Pack builder — locked',
    note: 'Read-only because a game using this pack is in progress.',
    render: () => <PackBuilder initialPack={F.PACK_LOCKED} />,
  },
  {
    id: 'pack-preview',
    group: 'Packs',
    name: 'Pack preview (host)',
    note: 'Host-only read-through. Correct answers are visible here by design.',
    render: () => (
      <PackPreview name={F.PACK_FULL.name} questions={F.PACK_FULL.questions} onClose={noop} />
    ),
  },

  // --- Setup & lobby -------------------------------------------------------
  {
    id: 'setup',
    group: 'Setup & Lobby',
    name: 'Game setup',
    note: 'Walk all 3 steps. "Worship History" is disabled — under 5 questions.',
    render: () => <GameSetup packs={F.SETUP_PACKS} />,
  },
  {
    id: 'lobby-host',
    group: 'Setup & Lobby',
    name: 'Lobby — host, Classic',
    note: '6 players including one guest.',
    render: () => <Lobby initial={F.lobbyClassic(true)} />,
  },
  {
    id: 'lobby-member',
    group: 'Setup & Lobby',
    name: 'Lobby — member',
    note: '"Waiting for host…" plus the emoji reaction bar.',
    render: () => <Lobby initial={F.lobbyClassic(false)} />,
  },
  {
    id: 'lobby-guest-link',
    group: 'Setup & Lobby',
    name: 'Lobby — guest link on',
    note: 'Shareable link + copy button.',
    render: () => <Lobby initial={F.LOBBY_WITH_GUEST_LINK} />,
  },
  {
    id: 'lobby-team',
    group: 'Setup & Lobby',
    name: 'Lobby — Team Battle',
    note: 'Two team columns, one unassigned player, Randomize button.',
    render: () => <Lobby initial={F.LOBBY_TEAM_BATTLE} />,
  },
  {
    id: 'lobby-alone',
    group: 'Setup & Lobby',
    name: 'Lobby — waiting for players',
    note: 'Start is disabled below 2 players.',
    render: () => <Lobby initial={F.LOBBY_ALONE} />,
  },
  {
    id: 'guest-open',
    group: 'Setup & Lobby',
    name: 'Guest join — open',
    note: 'Public page, no Hub login.',
    render: () => <GuestJoin token="preview-guest-token-abc123" state="open" />,
  },
  {
    id: 'guest-started',
    group: 'Setup & Lobby',
    name: 'Guest join — already started',
    render: () => <GuestJoin token="preview-guest-token-abc123" state="started" />,
  },
  {
    id: 'guest-invalid',
    group: 'Setup & Lobby',
    name: 'Guest join — bad link',
    render: () => <GuestJoin token="nope" state="invalid" />,
  },

  // --- Live game -----------------------------------------------------------
  {
    id: 'live-answering',
    group: 'Live Game',
    name: 'Question — answering',
    note: 'Multiple choice, ~4s into a 15s round. Timer is live.',
    render: () => <LiveGame initial={F.liveAnswering({ isHost: false })} />,
  },
  {
    id: 'live-final-seconds',
    group: 'Live Game',
    name: 'Question — final seconds',
    note: '12s into 15s: the urgent countdown state.',
    render: () => <LiveGame initial={F.LIVE_FINAL_SECONDS()} />,
  },
  {
    id: 'live-locked',
    group: 'Live Game',
    name: 'Question — answer locked',
    note: 'You have answered; waiting on everyone else.',
    render: () => <LiveGame initial={F.LIVE_ANSWER_LOCKED()} />,
  },
  {
    id: 'live-tf',
    group: 'Live Game',
    name: 'Question — True / False',
    note: 'Two-button layout instead of four.',
    render: () => <LiveGame initial={F.liveTrueFalse()} />,
  },
  {
    id: 'live-host',
    group: 'Live Game',
    name: 'Question — host controls',
    note: 'Host is game-master, not a player: pause / skip / end.',
    render: () => <LiveGame initial={F.liveAnswering({ isHost: true })} />,
  },
  {
    id: 'live-reveal-correct',
    group: 'Live Game',
    name: 'Reveal — you were right',
    render: () => <LiveGame initial={F.liveRevealCorrect()} />,
  },
  {
    id: 'live-reveal-wrong',
    group: 'Live Game',
    name: 'Reveal — you were wrong',
    render: () => <LiveGame initial={F.liveRevealWrong()} />,
  },
  {
    id: 'live-reveal-host',
    group: 'Live Game',
    name: 'Reveal — host view',
    note: 'Where "Next question" lives.',
    render: () => <LiveGame initial={F.liveRevealHost()} />,
  },
  {
    id: 'live-between',
    group: 'Live Game',
    name: 'Between rounds',
    render: () => <LiveGame initial={F.liveBetweenRounds()} />,
  },
  {
    id: 'live-survival',
    group: 'Live Game',
    name: 'Survival — last heart',
    note: 'You are on 1 of 3 hearts; two players already out.',
    render: () => <LiveGame initial={F.liveSurvivalLastHeart()} />,
  },
  {
    id: 'live-survival-out',
    group: 'Live Game',
    name: 'Survival — eliminated',
    note: 'Spectator mode: you watch, you cannot answer.',
    render: () => <LiveGame initial={F.liveSurvivalEliminated()} />,
  },
  {
    id: 'live-team',
    group: 'Live Game',
    name: 'Team Battle — in play',
    note: 'Team scores alongside individual standings.',
    render: () => <LiveGame initial={F.liveTeamBattle()} />,
  },

  // --- Results -------------------------------------------------------------
  {
    id: 'results-classic',
    group: 'Results',
    name: 'Results — Classic',
    note: 'Full podium sequence: rise, avatar drop, confetti, champion bob.',
    render: () => (
      <Results
        sessionId={F.PREVIEW_SESSION_ID}
        results={F.RESULTS_CLASSIC}
        isHost={false}
        mePlayerId={F.ME_PLAYER_ID}
      />
    ),
  },
  {
    id: 'results-classic-host',
    group: 'Results',
    name: 'Results — host (Play Again)',
    render: () => (
      <Results
        sessionId={F.PREVIEW_SESSION_ID}
        results={F.RESULTS_CLASSIC}
        isHost
        mePlayerId={null}
      />
    ),
  },
  {
    id: 'results-team',
    group: 'Results',
    name: 'Results — Team Battle',
    note: 'Team scores + individual rankings within teams.',
    render: () => (
      <Results
        sessionId={F.PREVIEW_SESSION_ID}
        results={F.RESULTS_TEAM}
        isHost={false}
        mePlayerId={F.ME_PLAYER_ID}
      />
    ),
  },
  {
    id: 'results-survival',
    group: 'Results',
    name: 'Results — Survival',
    note: 'Elimination order and hearts remaining.',
    render: () => (
      <Results
        sessionId={F.PREVIEW_SESSION_ID}
        results={F.RESULTS_SURVIVAL}
        isHost={false}
        mePlayerId={F.ME_PLAYER_ID}
      />
    ),
  },
  {
    id: 'results-tie',
    group: 'Results',
    name: 'Results — tied for 1st',
    note: 'Known simplification: every tied player wins the point (no sudden-death UI).',
    render: () => (
      <Results
        sessionId={F.PREVIEW_SESSION_ID}
        results={F.RESULTS_TIE}
        isHost={false}
        mePlayerId={F.ME_PLAYER_ID}
      />
    ),
  },
];

const GROUPS = [...new Set(SCENES.map((s) => s.group))];

// ---------------------------------------------------------------------------
// Display-face auditioner
// ---------------------------------------------------------------------------

/**
 * Swaps the Play display face live, so a typeface can be judged on the real
 * screens instead of in a specimen. Picking one repoints --font-play; "App
 * default" clears the override and shows whatever the app actually ships.
 */
function FontSwitcher({
  fonts,
  fontId,
  onPick,
}: {
  fonts: FontChoice[];
  fontId: string | null;
  onPick: (id: string | null) => void;
}) {
  if (fonts.length === 0) return null;
  const active = fonts.find((f) => f.id === fontId);
  return (
    <div className="flex max-w-full flex-col items-center gap-1">
      <div className="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/15 bg-zinc-900/95 px-1.5 py-1.5 shadow-2xl backdrop-blur">
        <span className="shrink-0 pl-1.5 pr-0.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
          Aa
        </span>
        <button
          onClick={() => onPick(null)}
          className={cnLocal(
            'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
            fontId === null ? 'bg-white text-zinc-900' : 'text-white/70 hover:bg-white/10',
          )}
        >
          App default
        </button>
        {fonts.map((f) => (
          <button
            key={f.id}
            onClick={() => onPick(f.id)}
            style={{ fontFamily: `var(${f.varName})` }}
            className={cnLocal(
              'shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold transition',
              fontId === f.id ? 'bg-white text-zinc-900' : 'text-white/70 hover:bg-white/10',
            )}
          >
            {f.name}
          </button>
        ))}
      </div>
      {active && (
        <span className="max-w-[22rem] px-2 text-center text-[10px] leading-snug text-white/50">
          {active.note}
        </span>
      )}
    </div>
  );
}

// Tiny local join so this dev-only file doesn't depend on the app's cn().
function cnLocal(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

export interface FontChoice {
  id: string;
  name: string;
  note: string;
  /** CSS var published by next/font for this candidate, e.g. --font-cand-archivo */
  varName: string;
}

export function PlayPreviewGallery({
  initialSceneId = null,
  fonts = [],
}: {
  initialSceneId?: string | null;
  fonts?: FontChoice[];
}) {
  usePreviewNetworkGuard();
  const [activeId, setActiveId] = useState<string | null>(
    initialSceneId && SCENES.some((s) => s.id === initialSceneId) ? initialSceneId : null,
  );
  const [barOpen, setBarOpen] = useState(true);
  const [fontId, setFontId] = useState<string | null>(null);

  // Point --font-play at the chosen candidate. Set inline on <html> so it beats
  // the class-based var from the root layout deterministically; clearing it
  // falls back to whatever the app actually ships.
  useEffect(() => {
    const root = document.documentElement;
    const chosen = fonts.find((f) => f.id === fontId);
    if (chosen) root.style.setProperty('--font-play', `var(${chosen.varName})`);
    else root.style.removeProperty('--font-play');
  }, [fontId, fonts]);

  const index = SCENES.findIndex((s) => s.id === activeId);
  const scene = index >= 0 ? SCENES[index] : null;

  // Keep the URL in step with the open scene so any screen can be linked or
  // reloaded directly (?scene=live-survival). replaceState, not a router push:
  // re-rendering the server component would remount and restart the animations.
  useEffect(() => {
    const url = activeId ? `?scene=${activeId}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [activeId]);

  // Arrow keys to walk scenes, Escape back to the index.
  useEffect(() => {
    if (!scene) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveId(null);
      if (e.key === 'ArrowRight') setActiveId(SCENES[(index + 1) % SCENES.length].id);
      if (e.key === 'ArrowLeft')
        setActiveId(SCENES[(index - 1 + SCENES.length) % SCENES.length].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scene, index]);

  if (scene) {
    return (
      <>
        {/* Remount on every scene change so mount animations and timers re-run. */}
        <div key={scene.id}>{scene.render()}</div>

        {barOpen ? (
          <div
            className="fixed bottom-3 left-1/2 z-[10000] flex max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-col items-center gap-1.5"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          >
            <FontSwitcher fonts={fonts} fontId={fontId} onPick={setFontId} />
            <div className="flex items-center gap-1 rounded-full border border-white/15 bg-zinc-900/95 px-1.5 py-1.5 text-white shadow-2xl backdrop-blur">
            <button
              onClick={() => setActiveId(null)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
            >
              All screens
            </button>
            <button
              onClick={() => setActiveId(SCENES[(index - 1 + SCENES.length) % SCENES.length].id)}
              className="rounded-full px-2.5 py-1.5 text-sm hover:bg-white/10"
              aria-label="Previous screen"
            >
              ‹
            </button>
            <span className="max-w-[9rem] truncate px-1 text-[11px] text-white/70">
              {index + 1}/{SCENES.length} · {scene.name}
            </span>
            <button
              onClick={() => setActiveId(SCENES[(index + 1) % SCENES.length].id)}
              className="rounded-full px-2.5 py-1.5 text-sm hover:bg-white/10"
              aria-label="Next screen"
            >
              ›
            </button>
            <button
              onClick={() => setBarOpen(false)}
              className="rounded-full px-2 py-1.5 text-xs text-white/50 hover:bg-white/10"
              aria-label="Hide controls"
            >
              ✕
            </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setBarOpen(true)}
            className="fixed bottom-3 right-3 z-[10000] h-9 w-9 rounded-full border border-white/15 bg-zinc-900/90 text-xs text-white shadow-2xl backdrop-blur"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
            aria-label="Show preview controls"
          >
            ⋯
          </button>
        )}
      </>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">GNW Play — screen gallery</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        {SCENES.length} screens and states, rendered from the real components with mock data. No
        database, no live game. Calls to <code>/api/play/*</code> are blocked while you are in here,
        so tapping things is safe.
      </p>
      <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
        Arrow keys walk between screens · Escape returns here
      </p>

      {fonts.length > 0 && (
        <section className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Play display face
          </h2>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            Swaps the arcade typeface live on every Play screen. The picker rides along in the
            control bar while you browse, so you can judge a face on a real question or podium
            rather than on a specimen. Only affects this preview.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              onClick={() => setFontId(null)}
              className={cnLocal(
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                fontId === null
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                  : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900',
              )}
            >
              App default
            </button>
            {fonts.map((f) => (
              <button
                key={f.id}
                onClick={() => setFontId(f.id)}
                style={{ fontFamily: `var(${f.varName})` }}
                className={cnLocal(
                  'rounded-full border px-3 py-1.5 text-sm font-bold transition',
                  fontId === f.id
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                    : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900',
                )}
                title={f.note}
              >
                {f.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {GROUPS.map((group) => (
        <section key={group} className="mt-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            {group}
          </h2>
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {SCENES.filter((s) => s.group === group).map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setActiveId(s.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{s.name}</span>
                    {s.note && (
                      <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                        {s.note}
                      </span>
                    )}
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-600">›</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
