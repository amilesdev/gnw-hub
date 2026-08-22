'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useGameChannel, sendReaction } from '@/lib/play/realtime-client';
import { playSfx, preloadSfx } from '@/lib/play/audio';
import { haptics } from '@/lib/haptics';
import { ReactionLayer, EmojiBar, useReactionList } from './Reactions';
import { Check, Pause, Play, Flame, Eye } from '@/components/shared/Icons';
import { Hearts } from './Hearts';
import { TimerRing } from './TimerRing';
import { RoomStrip } from './RoomStrip';
import { AnswerPanel } from './AnswerPanel';
import { Standings } from './Standings';
import { CountUp } from './CountUp';
import { usePlayActive } from '@/lib/play/use-play-active';
import { useStreaks, STREAK_MIN, STREAK_HOT } from '@/lib/play/use-streaks';
import type {
  GameMode,
  GameSnapshot,
  QuestionPayload,
  RoundResultPayload,
  RoundResultRow,
  LeaderboardEntry,
  TeamStanding,
} from '@/lib/play/types';

type Phase = 'waiting' | 'question' | 'reveal';

// How long the reveal holds before the host's client rolls the next question.
// Long enough to read the standings, short enough that the game never sits
// waiting on somebody to look down at their phone — the old screen had no
// timer at all here, so every round ended in dead air.
const ADVANCE_MS = 9000;
const ADVANCE_R = 15;
const ADVANCE_C = 2 * Math.PI * ADVANCE_R;

export function LiveGame({ initial }: { initial: GameSnapshot }) {
  usePlayActive();
  const router = useRouter();
  const sessionId = initial.session.id;
  const { mode, timeLimitMs, total } = initial.session;
  const isHost = initial.me.isHost;

  const [phase, setPhase] = useState<Phase>(
    initial.round.status === 'answering' && initial.question
      ? 'question'
      : initial.reveal
        ? 'reveal'
        : 'waiting',
  );
  const [question, setQuestion] = useState<QuestionPayload | null>(initial.question);
  const [startAt, setStartAt] = useState<number | null>(
    initial.round.questionStartAt ? new Date(initial.round.questionStartAt).getTime() : null,
  );
  const [selected, setSelected] = useState<string | null>(initial.myAnswer);
  const [locked, setLocked] = useState<boolean>(initial.myAnswer !== null);
  const [reveal, setReveal] = useState<RoundResultPayload | null>(initial.reveal);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(initial.leaderboard);
  const [teams, setTeams] = useState<TeamStanding[] | null>(initial.teams);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);
  const [hostGameOver, setHostGameOver] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [hearts, setHearts] = useState(initial.me.player?.hearts ?? 3);
  const [spectator, setSpectator] = useState(
    initial.me.player?.isSpectator ?? initial.me.player?.isEliminated ?? false,
  );
  const myPlayerId = initial.me.player?.playerId ?? null;

  // Host-side auto-advance. Deadline, or null when held / not in reveal.
  const [advanceAt, setAdvanceAt] = useState<number | null>(null);
  const [held, setHeld] = useState(false);

  const { streaks, record: recordStreaks } = useStreaks();
  const { floats, spawn } = useReactionList();
  const endedFor = useRef<string | null>(null); // host: one end-question per question
  const startedQ1 = useRef(false);

  // Rank movement has to be remembered HERE, not inside <Standings>: that
  // component unmounts every time the phase flips back to `question`, so a ref
  // living inside it would be wiped before the next reveal could ever read it —
  // the arrows would have never once appeared.
  const leaderboardRef = useRef(initial.leaderboard);
  const prevRanks = useRef(new Map<string, number>());

  const myScore = leaderboard.find((e) => e.playerId === myPlayerId)?.score ?? 0;
  const myStreak = myPlayerId ? (streaks.get(myPlayerId) ?? 0) : 0;

  // --- Realtime ----------------------------------------------------------
  useGameChannel(sessionId, (e) => {
    switch (e.type) {
      case 'QUESTION_START':
        setQuestion(e.question);
        setStartAt(new Date(e.questionStartAt).getTime());
        setSelected(null);
        setLocked(false);
        setReveal(null);
        setAnsweredIds(new Set());
        setAdvanceAt(null);
        setHeld(false);
        setPaused(false);
        setPhase('question');
        endedFor.current = null;
        playSfx('countdown-tick', { volume: 0.4 });
        break;
      // Every client gets the playerId, so every client can light that exact
      // face in the room strip — this used to only increment a host-only count.
      case 'ANSWER_LOCKED':
        setAnsweredIds((s) => {
          if (s.has(e.playerId)) return s;
          const next = new Set(s);
          next.add(e.playerId);
          return next;
        });
        break;
      case 'ROUND_RESULTS': {
        setReveal(e.results);
        recordStreaks(e.results);
        setPhase('reveal');
        playSfx('round-end');
        if (isHost) setAdvanceAt(Date.now() + ADVANCE_MS);
        const mine = e.results.rows.find((r) => r.playerId === myPlayerId);
        if (mine && !isHost) {
          setTimeout(() => {
            playSfx(mine.isCorrect ? 'answer-correct' : 'answer-wrong');
            if (mine.isCorrect) haptics.success();
            else haptics.warn();
            if ((mine.heartsLost ?? 0) > 0) {
              setHearts(mine.hearts ?? 0);
              playSfx('heart-lost');
            }
          }, 600);
        }
        break;
      }
      case 'LEADERBOARD_UPDATE':
        // Snapshot the standing order before replacing it, so the next reveal
        // can say how far each player moved.
        prevRanks.current = new Map(leaderboardRef.current.map((x) => [x.playerId, x.rank]));
        leaderboardRef.current = e.leaderboard;
        setLeaderboard(e.leaderboard);
        if (e.teams) setTeams(e.teams);
        break;
      case 'SURVIVAL_ELIMINATION':
        if (e.playerId === myPlayerId) {
          setSpectator(true);
          playSfx('elimination');
        }
        break;
      case 'GAME_PAUSED':
        setPaused(true);
        break;
      case 'GAME_RESUMED':
        setPaused(false);
        break;
      case 'PLAYER_REMOVED':
        if (e.playerId === myPlayerId) router.push('/play');
        break;
      case 'GAME_ENDED':
        router.push(`/play/session/${sessionId}/results`);
        break;
      case 'REACTION':
        spawn(e.emoji);
        break;
    }
  });

  // Fetch the round cues now, not at the moment each one is due. `countdown-tick`
  // fires on the same frame a question appears, so a lazy first load would put
  // it behind the question every single game.
  useEffect(() => {
    preloadSfx('countdown-tick', 'countdown-final', 'round-end', 'answer-correct', 'answer-wrong');
    if (mode === 'survival') preloadSfx('heart-lost', 'elimination');
  }, [mode]);

  // Host kicks off the very first question on mount.
  useEffect(() => {
    if (isHost && initial.round.roundNumber === 0 && !startedQ1.current) {
      startedQ1.current = true;
      apiFetch('/api/play/start-question', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }
  }, [isHost, initial.round.roundNumber, sessionId]);

  // Display clock. 100ms so the ring sweeps continuously rather than stepping.
  // `mounted` gates every clock-derived value: the server and the browser read
  // Date.now() at different instants, so rendering the ring during SSR hands
  // React a stroke-dashoffset that never matches and throws a hydration error.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  const remainingMs =
    mounted && startAt && phase === 'question' && !paused
      ? Math.max(0, startAt + timeLimitMs - now)
      : null;
  const secondsLeft = remainingMs !== null ? Math.ceil(remainingMs / 1000) : null;

  // Urgent tick for the final 3 seconds (once per second).
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (secondsLeft !== null && secondsLeft <= 3 && secondsLeft > 0 && lastTick.current !== secondsLeft) {
      lastTick.current = secondsLeft;
      playSfx('countdown-final', { volume: 0.6 });
      haptics.tap();
    }
    if (secondsLeft === null) lastTick.current = null;
  }, [secondsLeft]);

  // Host closes the round when its timer expires.
  const endQuestion = useCallback(async () => {
    if (!question || endedFor.current === question.id) return;
    endedFor.current = question.id;
    try {
      const res = await apiFetch<{ gameOver: boolean }>('/api/play/end-question', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      });
      setHostGameOver(res.gameOver);
    } catch {
      endedFor.current = null; // allow retry
    }
  }, [question, sessionId]);

  useEffect(() => {
    if (isHost && phase === 'question' && remainingMs === 0 && question && endedFor.current !== question.id) {
      endQuestion();
    }
  }, [isHost, phase, remainingMs, question, endQuestion]);

  const nextQuestion = useCallback(() => {
    setAdvanceAt(null);
    if (hostGameOver) {
      router.push(`/play/session/${sessionId}/results`);
      return;
    }
    apiFetch('/api/play/start-question', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
  }, [hostGameOver, router, sessionId]);

  // Auto-advance fires off the same display clock the timer ring uses.
  const advanceRemaining =
    mounted && advanceAt !== null && !paused ? Math.max(0, advanceAt - now) : null;
  useEffect(() => {
    if (isHost && phase === 'reveal' && advanceRemaining === 0) nextQuestion();
  }, [isHost, phase, advanceRemaining, nextQuestion]);

  // A game-wide pause shouldn't let the reveal timer run out underneath it.
  // Once paused mid-reveal the round stays manual, so resuming never yanks the
  // question away from a host who was mid-sentence.
  useEffect(() => {
    if (paused) {
      setAdvanceAt(null);
      setHeld(true);
    }
  }, [paused]);

  // --- Player actions ----------------------------------------------------
  const submit = async (option: string) => {
    if (locked || spectator || phase !== 'question' || !question) return;
    setSelected(option);
    setLocked(true);
    haptics.tap();
    try {
      await apiFetch('/api/play/submit-answer', {
        method: 'POST',
        body: JSON.stringify({ sessionId, questionId: question.id, answer: option }),
      });
    } catch {
      /* answer may have been too late; stay locked */
    }
  };

  const togglePause = () => {
    apiFetch(paused ? '/api/play/resume' : '/api/play/pause', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
  };

  const endGame = () => {
    apiFetch('/api/play/end-game', { method: 'POST', body: JSON.stringify({ sessionId }) }).catch(() => {});
  };

  const myRow = reveal?.rows.find((r) => r.playerId === myPlayerId);
  const players = leaderboard;

  return (
    <div className="app-shell play-stage relative overflow-hidden">
      {/* ── Status rail ── */}
      <header
        className="relative z-10 flex items-center gap-3 px-5 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.6rem)' }}
      >
        <div className="min-w-0">
          <div className="font-display text-sm font-black uppercase tracking-[0.16em] stage-soft">
            {question ? `Q${Math.min(question.index + 1, total)}` : '—'}
            <span className="stage-faint">/{total}</span>
          </div>
          {isHost ? (
            <div className="mt-0.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] stage-faint">
              Hosting
            </div>
          ) : (
            <CountUp
              value={myScore}
              className="mt-0.5 block font-display text-lg font-black leading-none tabular-nums stage-ink"
            />
          )}
        </div>

        {mode === 'survival' && !isHost && (
          <Hearts hearts={hearts} eliminated={spectator} size={17} className="shrink-0" />
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* A live streak surfaces where the eye already is — next to the clock. */}
          {!isHost && myStreak >= STREAK_MIN && phase !== 'question' && (
            <span
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black"
              style={{
                color: 'rgb(var(--play-heat))',
                background: 'rgb(var(--play-heat) / 0.14)',
              }}
            >
              <Flame
                width={12}
                height={12}
                className={cn(myStreak >= STREAK_HOT && 'play-heat-flicker')}
                aria-hidden
              />
              {myStreak}
            </span>
          )}
          {remainingMs !== null && (
            <TimerRing remainingMs={remainingMs} totalMs={timeLimitMs} paused={paused} />
          )}
          {isHost && (
            <button
              type="button"
              onClick={togglePause}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 stage-soft transition active:scale-95"
              aria-label={paused ? 'Resume game' : 'Pause game'}
            >
              {paused ? <Play width={17} height={17} /> : <Pause width={17} height={17} />}
            </button>
          )}
        </div>
      </header>

      {/* overflow-x-hidden is load-bearing: the spotlight cone is deliberately
          wider than its panel, and `overflow-y: auto` alone would compute
          overflow-x to `auto` and hand the player a horizontal scrollbar. */}
      {/* A flex column, not a plain block: the Team Battle scoreboard below is a
          sibling of the question, and with the question sized by `min-h-full`
          the two together overflowed the screen — answers C and D sat under the
          fold and you had to scroll to answer. As a flex parent, the scoreboard
          takes its height first and the question block takes what's left. */}
      <main className="no-scrollbar relative z-10 flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-5 pb-5">
        {/* Team scoreboard */}
        {mode === 'team_battle' && teams && (
          <div className="mb-4 grid shrink-0 grid-cols-2 gap-3">
            {teams.map((t, i) => (
              <div
                key={t.id}
                className="play-lit-edge relative overflow-hidden rounded-2xl p-3 text-center"
                style={{
                  background: `linear-gradient(160deg, ${
                    i === 0 ? 'rgb(var(--play-blue) / 0.22)' : 'rgb(var(--play-pink) / 0.22)'
                  }, rgb(255 255 255 / 0.04))`,
                }}
              >
                <div className="truncate text-[0.65rem] font-black uppercase tracking-[0.12em] stage-soft">
                  {t.name}
                </div>
                <CountUp
                  value={t.teamPoints}
                  className="block font-display text-3xl font-black tabular-nums stage-ink"
                />
              </div>
            ))}
          </div>
        )}

        {phase === 'waiting' && (
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <div className="animate-breathe font-display text-2xl font-bold stage-ink">
                Get ready…
              </div>
              <p className="mt-2 text-sm stage-faint">First question is loading.</p>
            </div>
          </div>
        )}

        {/* ── Answering ──
            The screen is split by weight rather than stacked from the top: the
            question takes the upper third under the house light, and the answer
            panels grow to fill the lower half, inside thumb reach. The old
            layout packed everything against the top and left a third of the
            stage empty below the fold. */}
        {phase === 'question' && question && (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <h1
              key={question.id}
              className="play-question-in flex flex-[1.1] items-center justify-center text-balance py-2 text-center font-display text-[1.6rem] font-bold leading-[1.15] tracking-[-0.02em] stage-ink"
            >
              {question.questionText}
            </h1>

            <RoomStrip players={players} answered={answeredIds} className="shrink-0" />

            {spectator ? (
              <div className="stage-panel mt-auto flex items-center gap-3 p-5">
                <Eye width={20} height={20} className="shrink-0 stage-soft" aria-hidden />
                <p className="text-sm stage-soft">
                  You&apos;re out — watching the rest play it out.
                </p>
              </div>
            ) : isHost ? (
              <button
                type="button"
                onClick={endQuestion}
                className="play-panel-in play-press mt-auto w-full rounded-2xl py-3.5 font-display text-base font-bold text-play-ink shadow-pop"
                style={{ background: 'rgb(var(--play-green))' }}
              >
                Reveal answer now
              </button>
            ) : (
              // flex-[1.6] + auto-rows-fr: the panels take the remaining height
              // instead of sitting at a fixed 84px with dead stage underneath.
              // min-h on each panel floors them on short screens; max-h caps
              // them on tall ones, and once capped the leftover flows back up
              // to the question rather than stretching the panels absurdly.
              <div
                className={cn(
                  'grid max-h-[21rem] flex-[1.6] auto-rows-fr gap-3',
                  question.type === 'true_false' ? 'grid-cols-1' : 'grid-cols-2',
                )}
              >
                {question.options.map((opt, i) => (
                  <AnswerPanel
                    key={`${question.id}-${i}`}
                    option={opt}
                    index={i}
                    type={question.type}
                    enterDelay={i * 55}
                    disabled={locked}
                    onSelect={() => submit(opt)}
                    state={!locked ? 'live' : selected === opt ? 'chosen' : 'dimmed'}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Reveal ── */}
        {phase === 'reveal' && reveal && (
          <div className="space-y-5">
            {!isHost && myRow && <Verdict row={myRow} mode={mode} streak={myStreak} />}

            {question && (
              <div
                className={cn(
                  'grid gap-3',
                  question.type === 'true_false' ? 'grid-cols-1' : 'grid-cols-2',
                )}
              >
                {question.options.map((opt, i) => {
                  const correct = opt === reveal.correctAnswer;
                  return (
                    <AnswerPanel
                      key={`${question.id}-r-${i}`}
                      option={opt}
                      index={i}
                      type={question.type}
                      state={correct ? 'correct' : myRow?.answer === opt ? 'missed' : 'wrong'}
                    />
                  );
                })}
              </div>
            )}

            <section className="space-y-2.5 pt-1">
              <h2 className="text-xs font-black uppercase tracking-[0.16em] stage-faint">Standings</h2>
              <Standings
                entries={leaderboard}
                mePlayerId={myPlayerId}
                mode={mode}
                streaks={streaks}
                prevRanks={prevRanks.current}
              />
            </section>

            {isHost ? (
              <AdvanceControl
                gameOver={hostGameOver}
                remainingMs={advanceRemaining}
                totalMs={ADVANCE_MS}
                held={held}
                onAdvance={nextQuestion}
                onHold={() => {
                  setHeld(true);
                  setAdvanceAt(null);
                }}
              />
            ) : (
              <p className="pt-1 text-center text-xs font-bold uppercase tracking-[0.14em] stage-faint">
                Next question coming up
              </p>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <div
        className="relative z-10 border-t border-white/10 px-5 pt-3"
        style={{
          paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
          background: 'rgb(var(--stage-bg) / 0.9)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {isHost ? (
          <button
            type="button"
            onClick={endGame}
            className="w-full rounded-lg py-2 text-center text-sm font-bold transition active:scale-[0.98]"
            style={{ color: 'rgb(var(--play-pink))' }}
          >
            End game
          </button>
        ) : (
          <EmojiBar
            tone="stage"
            onPick={(em) => myPlayerId && sendReaction(sessionId, em, myPlayerId)}
          />
        )}
      </div>

      {paused && (
        <div
          className="absolute inset-0 z-50 grid place-items-center px-8 text-center"
          style={{ background: 'rgb(var(--stage-bg) / 0.9)', backdropFilter: 'blur(6px)' }}
        >
          <div>
            <Pause width={30} height={30} className="mx-auto stage-soft" aria-hidden />
            <div className="mt-3 font-display text-2xl font-bold stage-ink">Paused</div>
            <div className="mt-1 text-sm stage-faint">The host will pick it back up.</div>
          </div>
        </div>
      )}

      <ReactionLayer floats={floats} />
    </div>
  );
}

/**
 * Your own result for the round. The points used to be a static "+800 pts"
 * string — here the number travels, which is what makes a score feel earned.
 */
function Verdict({
  row,
  mode,
  streak,
}: {
  row: RoundResultRow;
  mode: GameMode;
  streak: number;
}) {
  const good = row.isCorrect;
  const tint = good ? '--play-green' : '--play-pink';

  return (
    // z-20 puts this card in front of the spotlight cone below it. The light is
    // falling on the panel, so it belongs *behind* the card, not across it.
    <div
      className="play-lit-edge relative z-20 overflow-hidden rounded-2xl px-5 py-4 text-center"
      style={{
        background: `linear-gradient(165deg, rgb(var(${tint}) / 0.26), rgb(255 255 255 / 0.04))`,
        boxShadow: `inset 0 0 0 1px rgb(var(${tint}) / 0.45)`,
      }}
      role="status"
    >
      <div className="flex items-center justify-center gap-2">
        {good && <Check width={20} height={20} strokeWidth={3.2} style={{ color: `rgb(var(${tint}))` }} />}
        <span className="font-display text-xl font-bold stage-ink">
          {good ? (streak >= STREAK_HOT ? 'On fire' : 'Correct') : row.answer ? 'Not quite' : 'Out of time'}
        </span>
      </div>

      {good && (
        <CountUp
          value={row.pointsEarned}
          prefix="+"
          delay={180}
          className="mt-1 block font-display text-4xl font-black tabular-nums"
          // Solid token colour, not the 26% wash behind it — the number is the
          // payload of this card and has to clear AA on its own.
          style={{ color: `rgb(var(${tint}))` }}
        />
      )}

      {good && streak >= STREAK_MIN && (
        <div
          className="mt-1 flex items-center justify-center gap-1 text-xs font-bold"
          style={{ color: 'rgb(var(--play-heat))' }}
        >
          <Flame width={12} height={12} className={cn(streak >= STREAK_HOT && 'play-heat-flicker')} aria-hidden />
          {streak} in a row
        </div>
      )}

      {mode === 'survival' && (row.heartsLost ?? 0) > 0 && (
        <div className="mt-2 flex items-center justify-center gap-2 text-sm stage-soft">
          <span>Lost a life</span>
          <Hearts hearts={row.hearts ?? 0} size={14} />
        </div>
      )}
    </div>
  );
}

/**
 * The host's next-question control, with the auto-advance timer drawn onto it.
 * The ring is the honest version of "this is about to happen anyway" — the host
 * can tap to go now, or hold the round open to talk through an answer, which is
 * the thing a leader running trivia in a room actually needs.
 */
function AdvanceControl({
  gameOver,
  remainingMs,
  totalMs,
  held,
  onAdvance,
  onHold,
}: {
  gameOver: boolean;
  remainingMs: number | null;
  totalMs: number;
  held: boolean;
  onAdvance: () => void;
  onHold: () => void;
}) {
  const fraction = remainingMs !== null ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;

  return (
    <div className="flex items-center gap-3 pt-1">
      <button
        type="button"
        onClick={onAdvance}
        className="play-press flex flex-1 items-center justify-center gap-2.5 rounded-2xl py-3.5 font-display text-base font-bold text-play-ink shadow-pop"
        style={{ background: 'rgb(var(--play-green))' }}
      >
        {!held && remainingMs !== null && (
          <svg width="34" height="34" viewBox="0 0 34 34" className="-rotate-90" aria-hidden>
            <circle cx="17" cy="17" r={ADVANCE_R} fill="none" stroke="rgb(var(--play-ink) / 0.25)" strokeWidth="3" />
            <circle
              cx="17"
              cy="17"
              r={ADVANCE_R}
              fill="none"
              stroke="rgb(var(--play-ink))"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={ADVANCE_C}
              strokeDashoffset={ADVANCE_C * (1 - fraction)}
              style={{ transition: 'stroke-dashoffset 100ms linear' }}
            />
          </svg>
        )}
        {gameOver ? 'See results' : 'Next question'}
      </button>
      {!held && !gameOver && (
        <button
          type="button"
          onClick={onHold}
          className="shrink-0 rounded-2xl bg-white/10 px-4 py-3.5 text-sm font-bold stage-soft transition active:scale-95"
        >
          Hold
        </button>
      )}
    </div>
  );
}
