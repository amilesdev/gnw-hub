import 'server-only';
import { prisma } from '@/lib/prisma';
import { broadcast } from './realtime-server';
import { buildLeaderboard, buildTeamStandings } from './queries';
import {
  scoreRound,
  teamBattleRound,
  survivalHeartLosers,
  type PlayerAnswerInput,
} from './scoring';
import type {
  GameSettings,
  QuestionPayload,
  RoundResultRow,
  RoundResultPayload,
  FinalResultPayload,
  PodiumEntry,
  GameSnapshot,
} from './types';
import type { Actor } from './auth';
import type { GameSession, Question } from '@prisma/client';

export function getSettings(session: Pick<GameSession, 'settings'>): GameSettings {
  return session.settings as unknown as GameSettings;
}

const questionOrderOf = (s: Pick<GameSession, 'questionOrder'>) => s.questionOrder as unknown as string[];

async function activePlayerCount(sessionId: string): Promise<number> {
  return prisma.gamePlayer.count({ where: { sessionId, isEliminated: false } });
}

// --- Start / advance a question -----------------------------------------

export type StartResult = { ok: true } | { gameOver: true };

/**
 * Begin the question at the session's current index, or advance to the next one
 * if a round has already been played. Detects end-of-game (or survival sudden
 * death) and ends the game when appropriate. Records the server-authoritative
 * question_start_at — the single timing anchor for speed scoring.
 */
export async function startQuestion(sessionId: string): Promise<StartResult> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { roundState: true },
  });
  if (!session || !session.roundState) return { gameOver: true };

  const order = questionOrderOf(session);
  const len = order.length;
  const round = session.roundState;

  // After the first round, each start-question advances the index by one.
  let raw = round.roundNumber > 0 ? session.currentQuestionIndex + 1 : session.currentQuestionIndex;

  if (raw >= len) {
    if (session.mode === 'survival') {
      // Sudden death: loop the pack while 2+ remain; otherwise the game is over.
      if ((await activePlayerCount(sessionId)) <= 1) {
        await endGame(sessionId);
        return { gameOver: true };
      }
    } else {
      await endGame(sessionId);
      return { gameOver: true };
    }
  }

  if (raw !== session.currentQuestionIndex) {
    await prisma.gameSession.update({ where: { id: sessionId }, data: { currentQuestionIndex: raw } });
  }

  const question = await prisma.question.findUnique({ where: { id: order[raw % len] } });
  if (!question) return { gameOver: true };

  const startAt = new Date();
  await prisma.roundState.update({
    where: { sessionId },
    data: { questionStartAt: startAt, status: 'answering', roundNumber: { increment: 1 } },
  });

  const settings = getSettings(session);
  const payload: QuestionPayload = {
    id: question.id,
    type: question.type,
    questionText: question.questionText,
    options: (question.options as unknown as string[]) ?? [],
    index: raw,
    total: len,
  };
  await broadcast(sessionId, {
    type: 'QUESTION_START',
    questionIndex: raw,
    question: payload,
    questionStartAt: startAt.toISOString(),
    timeLimitMs: settings.time_per_question * 1000,
  });
  return { ok: true };
}

// --- Record an answer ----------------------------------------------------

export type AnswerResult = { accepted: true } | { accepted: false; status: number; reason: string };

export async function recordAnswer(
  sessionId: string,
  playerId: string,
  questionId: string,
  answer: string,
): Promise<AnswerResult> {
  const submittedAt = new Date(); // server time — never trust the client
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { roundState: true },
  });
  if (!session || !session.roundState) return { accepted: false, status: 404, reason: 'No session' };
  if (session.status !== 'active' || session.roundState.status !== 'answering') {
    return { accepted: false, status: 403, reason: 'Not accepting answers' };
  }

  const order = questionOrderOf(session);
  const currentQid = order[session.currentQuestionIndex % order.length];
  if (questionId !== currentQid) return { accepted: false, status: 409, reason: 'Stale question' };

  const player = await prisma.gamePlayer.findFirst({ where: { id: playerId, sessionId } });
  if (!player || player.isEliminated || player.isSpectator) {
    return { accepted: false, status: 403, reason: 'Not an active player' };
  }

  const existing = await prisma.gameAnswer.findUnique({
    where: { playerId_questionId: { playerId, questionId } },
  });
  if (existing) return { accepted: true }; // locked — no changing answers

  const start = session.roundState.questionStartAt ?? submittedAt;
  const timeTakenMs = Math.max(0, submittedAt.getTime() - start.getTime());

  await prisma.gameAnswer.create({
    data: { sessionId, playerId, questionId, answer, submittedAt, timeTakenMs },
  });
  await broadcast(sessionId, { type: 'ANSWER_LOCKED', playerId });
  return { accepted: true };
}

// --- End / score a question ---------------------------------------------

export async function endQuestion(sessionId: string): Promise<{ gameOver: boolean }> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { roundState: true, players: true, teams: true },
  });
  if (!session || !session.roundState) return { gameOver: true };
  if (session.status !== 'active') return { gameOver: session.status === 'ended' };
  // Idempotent: only score from the 'answering' phase.
  if (session.roundState.status !== 'answering') return { gameOver: false };

  await prisma.roundState.update({ where: { sessionId }, data: { status: 'revealing' } });

  const order = questionOrderOf(session);
  const len = order.length;
  const rawIndex = session.currentQuestionIndex;
  const question = (await prisma.question.findUnique({ where: { id: order[rawIndex % len] } })) as Question;
  const settings = getSettings(session);
  const timeLimitMs = settings.time_per_question * 1000;

  // Only players still in the game participate in scoring.
  const participants = session.players.filter((p) => !p.isEliminated && !p.isSpectator);
  const answers = await prisma.gameAnswer.findMany({
    where: { sessionId, questionId: question.id },
  });
  const answerByPlayer = new Map(answers.map((a) => [a.playerId, a]));

  const inputs: PlayerAnswerInput[] = participants.map((p) => {
    const a = answerByPlayer.get(p.id);
    return { playerId: p.id, answer: a?.answer ?? null, timeTakenMs: a?.timeTakenMs ?? null };
  });
  const scored = scoreRound(inputs, question.correctAnswer, timeLimitMs);

  // Persist correctness + points on the stored answer rows.
  await prisma.$transaction(
    scored
      .filter((s) => answerByPlayer.has(s.playerId))
      .map((s) =>
        prisma.gameAnswer.update({
          where: { id: answerByPlayer.get(s.playerId)!.id },
          data: { isCorrect: s.isCorrect, pointsEarned: s.pointsEarned },
        }),
      ),
  );

  // Mode effects -----------------------------------------------------------
  const heartsLost = new Map<string, number>();
  const newHearts = new Map<string, number>();

  if (session.mode === 'team_battle') {
    const teamNames = settings.team_names!;
    const teamOf = new Map(participants.map((p) => [p.id, p.team ?? '']));
    const deltas = teamBattleRound(scored, teamOf, teamNames);
    await prisma.$transaction(
      deltas
        .map((d) => {
          const team = session.teams.find((t) => t.name === d.team);
          return team
            ? prisma.gameTeam.update({ where: { id: team.id }, data: { teamPoints: { increment: d.pointDelta } } })
            : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    );
  }

  if (session.mode === 'survival') {
    const suddenDeath = rawIndex >= len;
    const losers = survivalHeartLosers(scored);
    const updates = participants.map((p) => {
      const lost = losers.has(p.id) ? 1 : 0;
      heartsLost.set(p.id, lost);
      const hearts = suddenDeath && lost ? 0 : Math.max(0, p.hearts - lost);
      newHearts.set(p.id, hearts);
      const eliminated = hearts <= 0;
      return prisma.gamePlayer.update({
        where: { id: p.id },
        data: { hearts, isEliminated: eliminated, isSpectator: eliminated },
      });
    });
    await prisma.$transaction(updates);
    for (const p of participants) {
      if ((newHearts.get(p.id) ?? p.hearts) <= 0) {
        await broadcast(sessionId, { type: 'SURVIVAL_ELIMINATION', playerId: p.id });
      }
    }
  }

  // Results + leaderboard --------------------------------------------------
  const nameOf = new Map(
    (
      await prisma.gamePlayer.findMany({
        where: { sessionId },
        include: { user: { select: { name: true } } },
      })
    ).map((p) => [p.id, p.user?.name ?? p.guestName ?? 'Guest']),
  );

  const rows: RoundResultRow[] = scored.map((s) => ({
    playerId: s.playerId,
    name: nameOf.get(s.playerId) ?? 'Player',
    answer: s.answer,
    isCorrect: s.isCorrect,
    pointsEarned: s.pointsEarned,
    timeTakenMs: s.timeTakenMs,
    ...(session.mode === 'survival'
      ? { heartsLost: heartsLost.get(s.playerId) ?? 0, hearts: newHearts.get(s.playerId) ?? 0 }
      : {}),
  }));

  const reveal: RoundResultPayload = { questionId: question.id, correctAnswer: question.correctAnswer, rows };
  await broadcast(sessionId, { type: 'ROUND_RESULTS', results: reveal });

  const leaderboard = await buildLeaderboard(sessionId);
  const teams = session.mode === 'team_battle' ? await buildTeamStandings(sessionId) : undefined;
  await broadcast(sessionId, { type: 'LEADERBOARD_UPDATE', leaderboard, teams });

  await prisma.roundState.update({ where: { sessionId }, data: { status: 'between_rounds' } });

  // End detection ----------------------------------------------------------
  let gameOver = false;
  if (session.mode === 'survival') {
    gameOver = (await activePlayerCount(sessionId)) <= 1;
  } else {
    gameOver = rawIndex >= len - 1; // last question scored
  }
  if (gameOver) await endGame(sessionId);
  return { gameOver };
}

// --- End the game: winner + Play Point + final results -------------------

export async function endGame(sessionId: string): Promise<void> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { players: { include: { user: { select: { name: true } } } } },
  });
  if (!session || session.status === 'ended') return;

  const leaderboard = await buildLeaderboard(sessionId);
  const teams = session.mode === 'team_battle' ? await buildTeamStandings(sessionId) : undefined;
  const scoreOf = new Map(leaderboard.map((e) => [e.playerId, e.score]));

  // Winner determination (simplified tie handling — see notes).
  let winnerPlayerIds: string[] = [];
  if (session.mode === 'survival') {
    const standing = session.players.filter((p) => !p.isEliminated);
    if (standing.length >= 1) {
      const maxHearts = Math.max(...standing.map((p) => p.hearts));
      winnerPlayerIds = standing.filter((p) => p.hearts === maxHearts).map((p) => p.id);
    } else {
      // Mutual elimination — fall back to highest cumulative score.
      const top = Math.max(0, ...leaderboard.map((e) => e.score));
      winnerPlayerIds = leaderboard.filter((e) => e.score === top).map((e) => e.playerId);
    }
  } else if (session.mode === 'team_battle' && teams) {
    const best = [...teams].sort(
      (a, b) => b.teamPoints - a.teamPoints || b.individualSum - a.individualSum,
    )[0];
    const winningMembers = session.players.filter((p) => p.team === best?.name);
    if (winningMembers.length) {
      const topScore = Math.max(...winningMembers.map((p) => scoreOf.get(p.id) ?? 0));
      winnerPlayerIds = winningMembers.filter((p) => (scoreOf.get(p.id) ?? 0) === topScore).map((p) => p.id);
    }
  } else {
    // classic
    const top = Math.max(0, ...leaderboard.map((e) => e.score));
    winnerPlayerIds = leaderboard.filter((e) => e.score === top).map((e) => e.playerId);
  }

  // Award Play Points: only winners, and only registered Hub users.
  const winnerUserIds = session.players
    .filter((p) => winnerPlayerIds.includes(p.id) && p.userId)
    .map((p) => p.userId as string);

  await prisma.$transaction([
    prisma.gamePlayer.updateMany({ where: { id: { in: winnerPlayerIds } }, data: { playPointsEarned: 1 } }),
    ...(winnerUserIds.length
      ? [prisma.user.updateMany({ where: { id: { in: winnerUserIds } }, data: { playPoints: { increment: 1 } } })]
      : []),
    prisma.gameSession.update({ where: { id: sessionId }, data: { status: 'ended', endedAt: new Date() } }),
  ]);

  const podium: PodiumEntry[] = leaderboard.slice(0, 3).map((e, i) => ({
    place: (i + 1) as 1 | 2 | 3,
    playerId: e.playerId,
    name: e.name,
    isGuest: e.isGuest,
    image: e.image,
    score: e.score,
  }));

  const eliminationOrder =
    session.mode === 'survival'
      ? session.players
          .filter((p) => p.isEliminated)
          .map((p) => ({ playerId: p.id, name: p.user?.name ?? p.guestName ?? 'Guest', hearts: p.hearts }))
      : undefined;

  const finalResults: FinalResultPayload = {
    mode: session.mode,
    podium,
    rankings: leaderboard,
    teams,
    eliminationOrder,
    winnerPlayerIds,
  };
  await broadcast(sessionId, { type: 'GAME_ENDED', finalResults });
}

// --- Final results for the results screen (reload-safe) ------------------

export async function buildFinalResults(sessionId: string): Promise<FinalResultPayload | null> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { players: { include: { user: { select: { name: true } } } } },
  });
  if (!session) return null;

  const leaderboard = await buildLeaderboard(sessionId);
  const teams = session.mode === 'team_battle' ? await buildTeamStandings(sessionId) : undefined;
  const winnerPlayerIds = session.players.filter((p) => p.playPointsEarned > 0).map((p) => p.id);

  const podium: PodiumEntry[] = leaderboard.slice(0, 3).map((e, i) => ({
    place: (i + 1) as 1 | 2 | 3,
    playerId: e.playerId,
    name: e.name,
    isGuest: e.isGuest,
    image: e.image,
    score: e.score,
  }));

  const eliminationOrder =
    session.mode === 'survival'
      ? session.players
          .filter((p) => p.isEliminated)
          .map((p) => ({ playerId: p.id, name: p.user?.name ?? p.guestName ?? 'Guest', hearts: p.hearts }))
      : undefined;

  return { mode: session.mode, podium, rankings: leaderboard, teams, eliminationOrder, winnerPlayerIds };
}

// --- Snapshot for live-game mount / reconnect ----------------------------

export async function buildGameSnapshot(
  sessionId: string,
  actor: Actor | null,
): Promise<GameSnapshot | null> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      roundState: true,
      players: { include: { user: { select: { name: true } } } },
    },
  });
  if (!session || !session.roundState) return null;

  const settings = getSettings(session);
  const order = questionOrderOf(session);
  const len = order.length;
  const round = session.roundState;
  const hasQuestion = round.roundNumber > 0;
  const question = hasQuestion
    ? await prisma.question.findUnique({ where: { id: order[session.currentQuestionIndex % len] } })
    : null;

  const isHost = actor?.kind === 'user' && actor.userId === session.hostId;
  const mePlayer =
    actor?.kind === 'user'
      ? session.players.find((p) => p.userId === actor.userId)
      : actor?.kind === 'guest'
        ? session.players.find((p) => p.id === actor.playerId)
        : undefined;

  const questionPayload: QuestionPayload | null = question
    ? {
        id: question.id,
        type: question.type,
        questionText: question.questionText,
        options: (question.options as unknown as string[]) ?? [],
        index: session.currentQuestionIndex,
        total: len,
      }
    : null;

  // Reveal (correct answer + rows) only once the round is no longer answering.
  let reveal: RoundResultPayload | null = null;
  let myAnswer: string | null = null;
  if (question) {
    const answers = await prisma.gameAnswer.findMany({ where: { sessionId, questionId: question.id } });
    if (mePlayer) myAnswer = answers.find((a) => a.playerId === mePlayer.id)?.answer ?? null;
    if (round.status !== 'answering') {
      const nameOf = new Map(session.players.map((p) => [p.id, p.user?.name ?? p.guestName ?? 'Guest']));
      reveal = {
        questionId: question.id,
        correctAnswer: question.correctAnswer,
        rows: answers.map((a) => ({
          playerId: a.playerId,
          name: nameOf.get(a.playerId) ?? 'Player',
          answer: a.answer,
          isCorrect: a.isCorrect ?? false,
          pointsEarned: a.pointsEarned,
          timeTakenMs: a.timeTakenMs,
        })),
      };
    }
  }

  const leaderboard = await buildLeaderboard(sessionId);
  const teams = session.mode === 'team_battle' ? await buildTeamStandings(sessionId) : null;

  return {
    session: {
      id: session.id,
      mode: session.mode,
      status: session.status,
      timeLimitMs: settings.time_per_question * 1000,
      total: len,
    },
    round: {
      status: round.status,
      questionStartAt: round.questionStartAt?.toISOString() ?? null,
      roundNumber: round.roundNumber,
    },
    question: questionPayload,
    reveal,
    me: {
      isHost,
      player: mePlayer
        ? {
            playerId: mePlayer.id,
            hearts: mePlayer.hearts,
            isEliminated: mePlayer.isEliminated,
            isSpectator: mePlayer.isSpectator,
            team: mePlayer.team,
          }
        : null,
    },
    myAnswer,
    leaderboard,
    teams,
  };
}
