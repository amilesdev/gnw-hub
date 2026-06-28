import 'server-only';
import { prisma } from '@/lib/prisma';
import { rankByScore } from './scoring';
import type { GameSettings, LeaderboardEntry, LobbySnapshot, TeamStanding } from './types';
import type { Actor } from './auth';

// "Only 1 active game session at a time across all of GNW Hub" (system
// constraint). The current session is the single non-ended one, if any.
export async function getCurrentSession() {
  return prisma.gameSession.findFirst({
    where: { status: { in: ['lobby', 'active'] } },
    orderBy: { createdAt: 'desc' },
  });
}

const playerName = (p: { guestName: string | null; user: { name: string } | null }) =>
  p.user?.name ?? p.guestName ?? 'Guest';

/**
 * Cumulative standings for a session: each non-spectator player's total points
 * (sum of their answer points) with competition ranking. Survival also surfaces
 * hearts + elimination so the live leaderboard can show them.
 */
export async function buildLeaderboard(sessionId: string): Promise<LeaderboardEntry[]> {
  const players = await prisma.gamePlayer.findMany({
    where: { sessionId },
    include: { user: { select: { name: true } }, answers: { select: { pointsEarned: true } } },
  });

  const scored = players.map((p) => ({
    playerId: p.id,
    score: p.answers.reduce((n, a) => n + a.pointsEarned, 0),
    name: playerName(p),
    isGuest: p.userId === null,
    team: p.team,
    hearts: p.hearts,
    isEliminated: p.isEliminated,
  }));

  return rankByScore(scored).map((p) => ({
    playerId: p.playerId,
    name: p.name,
    isGuest: p.isGuest,
    score: p.score,
    rank: p.rank,
    team: p.team,
    hearts: p.hearts,
    isEliminated: p.isEliminated,
  }));
}

/** Roster + session info for the lobby (and live-game reconnect header). */
export async function buildLobbySnapshot(
  sessionId: string,
  actor: Actor | null,
): Promise<LobbySnapshot | null> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      pack: { select: { name: true } },
      players: { include: { user: { select: { name: true } } }, orderBy: { joinedAt: 'asc' } },
    },
  });
  if (!session) return null;

  const settings = session.settings as unknown as GameSettings;
  const mePlayerId =
    actor?.kind === 'user'
      ? session.players.find((p) => p.userId === actor.userId)?.id ?? null
      : actor?.kind === 'guest'
        ? session.players.find((p) => p.id === actor.playerId)?.id ?? null
        : null;

  return {
    session: {
      id: session.id,
      mode: session.mode,
      status: session.status,
      packName: session.pack.name,
      guestToken: session.guestAccessEnabled ? session.guestLinkToken : null,
      teamNames: settings.team_names ?? null,
    },
    players: session.players.map((p) => ({
      id: p.id,
      name: p.user?.name ?? p.guestName ?? 'Guest',
      isGuest: p.userId === null,
      team: p.team,
    })),
    mePlayerId,
    isHost: actor?.kind === 'user' && actor.userId === session.hostId,
  };
}

export interface PlayPointsRow {
  id: string;
  name: string;
  playPoints: number;
  rank: number;
}

/** All-time Play Points leaderboard across every Hub user (wins desc). */
export async function getPlayPointsLeaderboard(): Promise<PlayPointsRow[]> {
  const users = await prisma.user.findMany({
    where: { status: 'active' },
    orderBy: [{ playPoints: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, playPoints: true },
  });
  let lastPoints = Number.NaN;
  let lastRank = 0;
  return users.map((u, i) => {
    if (u.playPoints !== lastPoints) {
      lastRank = i + 1;
      lastPoints = u.playPoints;
    }
    return { id: u.id, name: u.name, playPoints: u.playPoints, rank: lastRank };
  });
}

/** Team standings: stored team points plus the live sum of member scores. */
export async function buildTeamStandings(sessionId: string): Promise<TeamStanding[]> {
  const [teams, leaderboard] = await Promise.all([
    prisma.gameTeam.findMany({ where: { sessionId } }),
    buildLeaderboard(sessionId),
  ]);
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    teamPoints: t.teamPoints,
    individualSum: leaderboard
      .filter((p) => p.team === t.name)
      .reduce((n, p) => n + p.score, 0),
  }));
}
