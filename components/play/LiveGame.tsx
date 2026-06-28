'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useGameChannel, sendReaction } from '@/lib/play/realtime-client';
import { playSfx } from '@/lib/play/audio';
import { ReactionLayer, EmojiBar, useReactionList } from './Reactions';
import { Check, X, Pause, Play } from '@/components/shared/Icons';
import { usePlayActive } from '@/lib/play/use-play-active';
import type {
  GameSnapshot,
  QuestionPayload,
  RoundResultPayload,
  LeaderboardEntry,
  TeamStanding,
} from '@/lib/play/types';

// Bright Kahoot-style option colors (pink / blue / orange / green).
const OPTION_COLORS = ['#FF5C8A', '#38B2FF', '#FF9F43', '#2EC46E'];
const LETTERS = ['A', 'B', 'C', 'D'];

type Phase = 'waiting' | 'question' | 'reveal';

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
  const [answeredCount, setAnsweredCount] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hostGameOver, setHostGameOver] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [hearts, setHearts] = useState(initial.me.player?.hearts ?? 3);
  const [spectator, setSpectator] = useState(
    initial.me.player?.isSpectator ?? initial.me.player?.isEliminated ?? false,
  );
  const myPlayerId = initial.me.player?.playerId ?? null;

  const { floats, spawn } = useReactionList();
  const endedFor = useRef<string | null>(null); // host: guard one end-question per question
  const startedQ1 = useRef(false);

  // --- Realtime ----------------------------------------------------------
  useGameChannel(sessionId, (e) => {
    switch (e.type) {
      case 'QUESTION_START':
        setQuestion(e.question);
        setStartAt(new Date(e.questionStartAt).getTime());
        setSelected(null);
        setLocked(false);
        setReveal(null);
        setAnsweredCount(0);
        setPaused(false);
        setPhase('question');
        endedFor.current = null;
        playSfx('countdown-tick', { volume: 0.4 });
        break;
      case 'ANSWER_LOCKED':
        setAnsweredCount((c) => c + 1);
        break;
      case 'ROUND_RESULTS': {
        setReveal(e.results);
        setPhase('reveal');
        playSfx('round-end');
        const mine = e.results.rows.find((r) => r.playerId === myPlayerId);
        if (mine && !isHost) {
          setTimeout(() => {
            playSfx(mine.isCorrect ? 'answer-correct' : 'answer-wrong');
            if ((mine.heartsLost ?? 0) > 0) {
              setHearts(mine.hearts ?? 0);
              playSfx('heart-lost');
            }
          }, 600);
        }
        break;
      }
      case 'LEADERBOARD_UPDATE':
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

  // Display clock.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const remainingMs = startAt && phase === 'question' && !paused ? Math.max(0, startAt + timeLimitMs - now) : null;
  const secondsLeft = remainingMs !== null ? Math.ceil(remainingMs / 1000) : null;

  // Urgent tick for the final 3 seconds (once per second).
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (secondsLeft !== null && secondsLeft <= 3 && secondsLeft > 0 && lastTick.current !== secondsLeft) {
      lastTick.current = secondsLeft;
      playSfx('countdown-final', { volume: 0.6 });
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

  // --- Player actions ----------------------------------------------------
  const submit = async (option: string) => {
    if (locked || spectator || phase !== 'question' || !question) return;
    setSelected(option);
    setLocked(true);
    try {
      await apiFetch('/api/play/submit-answer', {
        method: 'POST',
        body: JSON.stringify({ sessionId, questionId: question.id, answer: option }),
      });
    } catch {
      /* answer may have been too late; stay locked */
    }
  };

  const nextQuestion = () => {
    if (hostGameOver) {
      router.push(`/play/session/${sessionId}/results`);
      return;
    }
    apiFetch('/api/play/start-question', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
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

  return (
    <div className="app-shell play-surface relative">
      {/* Top status bar */}
      <header
        className="flex items-center gap-3 px-5 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.6rem)' }}
      >
        <span className="text-sm font-bold text-ink-soft">
          {question ? `Q${Math.min(question.index + 1, total)}` : ''}
          <span className="text-ink-faint">/{total}</span>
        </span>
        {mode === 'survival' && !isHost && (
          <span className="flex gap-0.5 text-lg" aria-label={`${hearts} hearts`}>
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className={cn(i >= hearts && 'opacity-25')}>
                ❤️
              </span>
            ))}
          </span>
        )}
        {secondsLeft !== null && (
          <span
            className={cn(
              'ml-auto font-display text-2xl font-bold tabular-nums',
              secondsLeft <= 3 ? 'text-bad' : 'text-ink',
            )}
          >
            {secondsLeft}
          </span>
        )}
        {isHost && (
          <button
            type="button"
            onClick={togglePause}
            className="ml-auto grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-soft"
            aria-label={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <Play width={16} height={16} /> : <Pause width={16} height={16} />}
          </button>
        )}
      </header>

      {/* Timer bar */}
      {phase === 'question' && (
        <div className="mx-5 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200 ease-linear"
            style={{ width: `${remainingMs !== null ? (remainingMs / timeLimitMs) * 100 : 100}%` }}
          />
        </div>
      )}

      <main className="no-scrollbar flex-1 overflow-y-auto px-5 py-4">
        {/* Team scoreboard */}
        {mode === 'team_battle' && teams && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            {teams.map((t) => (
              <div key={t.id} className="card p-3 text-center">
                <div className="relative z-10">
                  <div className="truncate text-xs font-bold uppercase text-ink-faint">{t.name}</div>
                  <div className="font-display text-2xl font-bold text-accent-ink dark:text-accent-on">{t.teamPoints}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {phase === 'waiting' && (
          <div className="grid h-full place-items-center text-center text-ink-faint">
            <div className="animate-breathe font-display text-xl">Get ready…</div>
          </div>
        )}

        {phase === 'question' && question && (
          <div className="space-y-5">
            <h1 className="text-center font-display text-2xl font-semibold leading-snug">{question.questionText}</h1>
            {spectator ? (
              <p className="text-center text-ink-faint">You&apos;re spectating — watch the action.</p>
            ) : isHost ? (
              <div className="card p-5 text-center text-ink-soft">
                <div className="font-display text-3xl font-bold text-ink">{answeredCount}</div>
                <div className="text-sm">answers locked in</div>
                <button type="button" onClick={endQuestion} className="btn-primary mt-4 w-full">
                  Reveal answer
                </button>
              </div>
            ) : (
              <div className={cn('grid gap-3', question.type === 'true_false' ? 'grid-cols-1' : 'grid-cols-2')}>
                {question.options.map((opt, i) => {
                  const chosen = selected === opt;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={locked}
                      onClick={() => submit(opt)}
                      className={cn(
                        'play-press flex min-h-[5.5rem] items-center gap-2 rounded-2xl p-4 text-left font-semibold text-white shadow-pop transition active:scale-[0.98]',
                        locked && !chosen && 'opacity-40',
                      )}
                      style={{ backgroundColor: OPTION_COLORS[i % 4] }}
                    >
                      <span className="relative z-10 grid h-7 w-7 place-items-center rounded-lg bg-white/25 text-sm font-bold">
                        {question.type === 'true_false' ? '' : LETTERS[i]}
                      </span>
                      <span className="relative z-10 flex-1">{opt}</span>
                      {chosen && <Check className="relative z-10" width={20} height={20} />}
                    </button>
                  );
                })}
              </div>
            )}
            {locked && !isHost && !spectator && (
              <p className="text-center text-sm font-semibold text-accent-ink dark:text-accent-on">
                Locked in! Waiting for others…
              </p>
            )}
          </div>
        )}

        {phase === 'reveal' && reveal && (
          <div className="space-y-5">
            {question && (
              <div className={cn('grid gap-3', question.type === 'true_false' ? 'grid-cols-1' : 'grid-cols-2')}>
                {question.options.map((opt, i) => {
                  const correct = opt === reveal.correctAnswer;
                  const myWrong = myRow?.answer === opt && !correct;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex min-h-[4.5rem] items-center gap-2 rounded-2xl p-4 font-semibold text-white',
                        !correct && 'opacity-35',
                      )}
                      style={{ backgroundColor: OPTION_COLORS[i % 4] }}
                    >
                      <span className="flex-1">{opt}</span>
                      {correct && <Check width={20} height={20} />}
                      {myWrong && <X width={20} height={20} />}
                    </div>
                  );
                })}
              </div>
            )}

            {!isHost && myRow && (
              <div
                className={cn(
                  'card p-5 text-center',
                  myRow.isCorrect ? 'ring-2 ring-good' : 'ring-2 ring-bad',
                )}
              >
                <div className="font-display text-2xl font-bold">
                  {myRow.isCorrect ? 'Correct!' : myRow.answer ? 'Not quite' : 'No answer'}
                </div>
                {myRow.isCorrect && <div className="mt-1 text-good">+{myRow.pointsEarned} pts</div>}
                {mode === 'survival' && (myRow.heartsLost ?? 0) > 0 && (
                  <div className="mt-1 text-sm text-bad">−1 ❤️ ({myRow.hearts} left)</div>
                )}
              </div>
            )}

            {/* Standings */}
            <section className="space-y-2">
              <h2 className="eyebrow">Standings</h2>
              {leaderboard.slice(0, 5).map((e) => (
                <div
                  key={e.playerId}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5',
                    e.playerId === myPlayerId && 'ring-2 ring-accent',
                  )}
                >
                  <span className="w-5 text-center font-bold text-ink-faint">{e.rank}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {e.name}
                    {mode === 'survival' && e.hearts !== undefined && (
                      <span className="ml-1 text-xs">{e.isEliminated ? '💀' : '❤️'.repeat(e.hearts)}</span>
                    )}
                  </span>
                  <span className="font-display font-bold tabular-nums">{e.score}</span>
                </div>
              ))}
            </section>

            {isHost && (
              <button type="button" onClick={nextQuestion} className="btn-primary w-full">
                {hostGameOver ? 'See results →' : 'Next question →'}
              </button>
            )}
          </div>
        )}
      </main>

      {/* Footer: host end-game, or player/spectator reactions */}
      <div
        className="border-t border-line bg-app/95 px-5 pt-3 backdrop-blur"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        {isHost ? (
          <button type="button" onClick={endGame} className="w-full text-center text-sm font-semibold text-bad">
            End game
          </button>
        ) : (
          <EmojiBar onPick={(em) => myPlayerId && sendReaction(sessionId, em, myPlayerId)} />
        )}
      </div>

      {paused && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-ink/75 text-center text-white">
          <div>
            <div className="font-display text-2xl font-bold">Paused</div>
            <div className="mt-1 text-white/70">Waiting for the host…</div>
          </div>
        </div>
      )}

      <ReactionLayer floats={floats} />
    </div>
  );
}
