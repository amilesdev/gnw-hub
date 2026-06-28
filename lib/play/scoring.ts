// GNW Play — pure scoring logic (no I/O). The live engine (API routes) calls
// these after recording server-authoritative timings, then persists + broadcasts
// the results. Keeping this pure makes the rules unit-testable in isolation.

export const BASE_POINTS = 1000;
export const SPEED_BONUS_MAX = 500;

/**
 * Universal per-answer score (spec §6.1). Faster correct answers earn more; a
 * wrong/late answer earns 0. Speed bonus is clamped to ≥0 so an over-limit
 * answer (shouldn't happen — server cuts off at the limit) never goes negative.
 */
export function calculatePoints(isCorrect: boolean, timeTakenMs: number, timeLimitMs: number): number {
  if (!isCorrect) return 0;
  const speedBonus = Math.round((1 - timeTakenMs / timeLimitMs) * SPEED_BONUS_MAX);
  return BASE_POINTS + Math.max(0, speedBonus);
}

export interface PlayerAnswerInput {
  playerId: string;
  answer: string | null; // null = did not submit
  timeTakenMs: number | null; // server-computed; null when no submission
}

export interface ScoredPlayer {
  playerId: string;
  answer: string | null;
  isCorrect: boolean;
  timeTakenMs: number | null;
  pointsEarned: number;
}

/** Score every player for one question. Correctness is exact string equality. */
export function scoreRound(
  answers: PlayerAnswerInput[],
  correctAnswer: string,
  timeLimitMs: number,
): ScoredPlayer[] {
  return answers.map((a) => {
    const isCorrect = a.answer !== null && a.answer === correctAnswer;
    const pointsEarned =
      isCorrect && a.timeTakenMs !== null ? calculatePoints(true, a.timeTakenMs, timeLimitMs) : 0;
    return { playerId: a.playerId, answer: a.answer, isCorrect, timeTakenMs: a.timeTakenMs, pointsEarned };
  });
}

// --- Ranking -------------------------------------------------------------

export interface Rankable {
  playerId: string;
  score: number;
}

/** Standard-competition ranking (ties share a rank; next rank skips). */
export function rankByScore<T extends Rankable>(players: T[]): (T & { rank: number })[] {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  let lastScore = Number.NaN;
  let lastRank = 0;
  return sorted.map((p, i) => {
    if (p.score !== lastScore) {
      lastRank = i + 1;
      lastScore = p.score;
    }
    return { ...p, rank: lastRank };
  });
}

/** PlayerIds tied for 1st place (length > 1 ⇒ classic tie-breaker needed). */
export function firstPlaceTie(players: Rankable[]): string[] {
  if (players.length === 0) return [];
  const top = Math.max(...players.map((p) => p.score));
  return players.filter((p) => p.score === top).map((p) => p.playerId);
}

// --- Team Battle (spec §6.3) --------------------------------------------

export interface TeamRoundDelta {
  team: string;
  individualSum: number;
  allCorrect: boolean;
  allWrongOrAbsent: boolean;
  pointDelta: number; // applied to game_teams.team_points this round
}

/**
 * Compute each team's team-point change for a round.
 * - Higher round-sum team: +1 (tie ⇒ 0 for both).
 * - Independent overrides (checked after individual scoring):
 *     all members correct        → +2 (replaces the +1)
 *     all members wrong/no-answer → −2
 */
export function teamBattleRound(
  scored: ScoredPlayer[],
  teamOf: Map<string, string>,
  teamNames: [string, string],
): TeamRoundDelta[] {
  const summarize = (team: string) => {
    const members = scored.filter((s) => teamOf.get(s.playerId) === team);
    const individualSum = members.reduce((n, m) => n + m.pointsEarned, 0);
    const allCorrect = members.length > 0 && members.every((m) => m.isCorrect);
    const allWrongOrAbsent = members.length > 0 && members.every((m) => !m.isCorrect);
    return { team, members, individualSum, allCorrect, allWrongOrAbsent };
  };

  const [a, b] = teamNames.map(summarize);

  const base = (self: typeof a, other: typeof a) => (self.individualSum > other.individualSum ? 1 : 0);
  const resolve = (self: typeof a, other: typeof a): TeamRoundDelta => {
    let pointDelta = base(self, other);
    if (self.allCorrect) pointDelta = 2;
    else if (self.allWrongOrAbsent) pointDelta = -2;
    return {
      team: self.team,
      individualSum: self.individualSum,
      allCorrect: self.allCorrect,
      allWrongOrAbsent: self.allWrongOrAbsent,
      pointDelta,
    };
  };

  return [resolve(a, b), resolve(b, a)];
}

// --- Survival (spec §6.4) ------------------------------------------------

/**
 * Players who lose a heart (or, in sudden death, are eliminated) this round.
 * - Every wrong / non-answer loses a heart.
 * - The SLOWEST correct answerer(s) also lose a heart — even when everyone is
 *   correct, no one is exempt.
 *
 * NOTE: the spec text says "find the minimum time_taken_ms" but labels it
 * "tied-slowest" and the stated intent is repeatedly "the slowest player(s) lose
 * a heart". Minimum time = fastest, which contradicts that intent, so we
 * penalize the MAXIMUM time (the genuinely slowest correct answerer). A Set
 * naturally caps loss at one heart per player per round.
 */
export function survivalHeartLosers(scored: ScoredPlayer[]): Set<string> {
  const losers = new Set<string>();
  for (const s of scored) if (!s.isCorrect) losers.add(s.playerId);

  const correct = scored.filter((s) => s.isCorrect && s.timeTakenMs !== null);
  if (correct.length > 0) {
    const slowest = Math.max(...correct.map((s) => s.timeTakenMs as number));
    for (const s of correct) if (s.timeTakenMs === slowest) losers.add(s.playerId);
  }
  return losers;
}
