// GNW Play — preview fixtures for the dev-only screen gallery (/play-preview).
//
// Every fixture is typed against the REAL payload types the server broadcasts.
// That's the point: if a Play type ever changes, `npx tsc --noEmit` breaks here
// and the gallery is forced back in sync instead of silently showing a screen
// shape the app no longer produces.
//
// Nothing here touches the database. `import type` is erased at compile time, so
// pulling `PlayPointsRow` out of queries.ts does not drag prisma into the client
// bundle.

import type {
  FinalResultPayload,
  GameSnapshot,
  LeaderboardEntry,
  LobbyPlayer,
  LobbySnapshot,
  QuestionPayload,
  RoundResultPayload,
  TeamStanding,
} from './types';
import type { PlayPointsRow } from './queries';
import type { SerializedPack, SerializedQuestion } from './packs';
import type { ActiveGame, PackSummary } from '@/components/play/PlayHome';
import type { SetupPack } from '@/components/play/GameSetup';

/** Stands in for the signed-in leader across every scene. */
export const ME_USER_ID = 'preview-user-1';
export const ME_PLAYER_ID = 'preview-player-1';
export const PREVIEW_SESSION_ID = 'preview-session';

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

interface Person {
  playerId: string;
  userId: string;
  name: string;
  image: string | null;
}

/**
 * A stand-in profile picture. Every fixture person used to carry `image: null`,
 * so the preview only ever exercised the initials fallback and the photo path
 * — which is what a real member with an uploaded picture gets on every one of
 * these screens — was invisible here. These are deliberately abstract rather
 * than an attempt at anyone's likeness; they exist to prove the `<img>` branch
 * renders, crops and rounds correctly at each size.
 */
const portrait = (bg: string, fg: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">` +
      `<rect width="80" height="80" fill="${bg}"/>` +
      `<circle cx="40" cy="30" r="14" fill="${fg}"/>` +
      `<path d="M6 80c0-18 15-29 34-29s34 11 34 29z" fill="${fg}"/>` +
      `</svg>`,
  )}`;

// Some people have uploaded a picture and some haven't — both states are on
// screen at once, which is exactly the mix a real game ends with.
export const PEOPLE: Person[] = [
  { playerId: ME_PLAYER_ID, userId: ME_USER_ID, name: 'Alonzo Miles', image: portrait('#3f3357', '#c9c0e8') },
  { playerId: 'preview-player-2', userId: 'preview-user-2', name: 'Aleena Miles', image: portrait('#4a3a2c', '#f0d9b8') },
  { playerId: 'preview-player-3', userId: 'preview-user-3', name: 'Judy Thomas', image: portrait('#25404a', '#b9dfe6') },
  { playerId: 'preview-player-4', userId: 'preview-user-4', name: 'Vanessa Cruz', image: null },
  { playerId: 'preview-player-5', userId: 'preview-user-5', name: 'Araelia Rodrigues', image: portrait('#4a2a3a', '#eec3d6') },
  { playerId: 'preview-player-6', userId: 'preview-user-6', name: 'Marcus Bell', image: null },
];

/** A guest player — no Hub account, joined via the share link. */
const GUEST: Person = {
  playerId: 'preview-player-guest',
  userId: '',
  name: 'Tasha',
  image: null,
};

// ---------------------------------------------------------------------------
// Questions & packs
// ---------------------------------------------------------------------------

const QUESTIONS: SerializedQuestion[] = [
  {
    id: 'q1',
    type: 'multiple_choice',
    questionText: 'Which book comes directly after Psalms?',
    options: ['Proverbs', 'Job', 'Isaiah', 'Ecclesiastes'],
    correctAnswer: 'Proverbs',
    orderIndex: 0,
  },
  {
    id: 'q2',
    type: 'multiple_choice',
    questionText: 'Who wrote the majority of the Psalms?',
    options: ['David', 'Solomon', 'Moses', 'Asaph'],
    correctAnswer: 'David',
    orderIndex: 1,
  },
  {
    id: 'q3',
    type: 'true_false',
    questionText: 'The word "worship" appears in the book of Genesis.',
    options: ['True', 'False'],
    correctAnswer: 'True',
    orderIndex: 2,
  },
  {
    id: 'q4',
    type: 'multiple_choice',
    questionText: 'What instrument did David play for King Saul?',
    options: ['Harp', 'Trumpet', 'Timbrel', 'Lyre'],
    correctAnswer: 'Harp',
    orderIndex: 3,
  },
  {
    id: 'q5',
    type: 'multiple_choice',
    questionText: 'How many books are in the New Testament?',
    options: ['27', '39', '24', '31'],
    correctAnswer: '27',
    orderIndex: 4,
  },
  {
    id: 'q6',
    type: 'true_false',
    questionText: 'Paul wrote the book of Hebrews.',
    options: ['True', 'False'],
    correctAnswer: 'False',
    orderIndex: 5,
  },
  {
    id: 'q7',
    type: 'multiple_choice',
    questionText: 'Which of these is NOT one of the fruits of the Spirit?',
    options: ['Wisdom', 'Peace', 'Gentleness', 'Faithfulness'],
    correctAnswer: 'Wisdom',
    orderIndex: 6,
  },
  {
    id: 'q8',
    // Deliberately incomplete: no correct answer picked yet. Exercises the
    // builder's "incomplete" badge and the blocked-launch validation path.
    type: 'multiple_choice',
    questionText: 'Which city did Paul write to about love being patient?',
    options: ['Corinth', 'Ephesus', 'Rome', ''],
    correctAnswer: '',
    orderIndex: 7,
  },
];

export const PACK_FULL: SerializedPack = {
  id: 'preview-pack-1',
  name: 'Sunday Warm-Up',
  locked: false,
  questions: QUESTIONS,
};

export const PACK_EMPTY: SerializedPack = {
  id: 'preview-pack-empty',
  name: 'Untitled Pack',
  locked: false,
  questions: [],
};

export const PACK_LOCKED: SerializedPack = {
  ...PACK_FULL,
  id: 'preview-pack-locked',
  name: 'Youth Night Trivia',
  locked: true,
};

export const PACK_SUMMARIES: PackSummary[] = [
  {
    id: 'preview-pack-1',
    name: 'Sunday Warm-Up',
    questionCount: 8,
    updatedAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
  },
  {
    id: 'preview-pack-2',
    name: 'Youth Night Trivia',
    questionCount: 12,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
  },
  {
    id: 'preview-pack-3',
    name: 'Worship History',
    questionCount: 3,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(),
  },
];

export const SETUP_PACKS: SetupPack[] = [
  { id: 'preview-pack-1', name: 'Sunday Warm-Up', questionCount: 8 },
  { id: 'preview-pack-2', name: 'Youth Night Trivia', questionCount: 12 },
  // Under MIN_QUESTIONS_TO_PLAY — renders disabled with "Need 5+ questions".
  { id: 'preview-pack-3', name: 'Worship History', questionCount: 3 },
];

// ---------------------------------------------------------------------------
// Play Home / leaderboard
// ---------------------------------------------------------------------------

const points = (person: Person, playPoints: number, rank: number): PlayPointsRow => ({
  id: person.userId,
  name: person.name,
  image: person.image,
  playPoints,
  rank,
});

export const PLAY_POINTS: PlayPointsRow[] = [
  points(PEOPLE[2], 9, 1),
  points(PEOPLE[1], 7, 2),
  points(PEOPLE[0], 5, 3),
  points(PEOPLE[3], 5, 3),
  points(PEOPLE[4], 2, 5),
  points(PEOPLE[5], 0, 6),
];

export const ACTIVE_GAME_LOBBY: ActiveGame = {
  sessionId: PREVIEW_SESSION_ID,
  mode: 'classic',
  status: 'lobby',
  packName: 'Sunday Warm-Up',
  playerCount: 5,
  isHost: true,
};

export const ACTIVE_GAME_LIVE: ActiveGame = {
  ...ACTIVE_GAME_LOBBY,
  mode: 'team_battle',
  status: 'active',
  playerCount: 6,
};

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

function lobbyPlayer(p: Person, team: string | null = null, isGuest = false): LobbyPlayer {
  return { id: p.playerId, name: p.name, isGuest, image: p.image, team };
}

export function lobbyClassic(isHost: boolean): LobbySnapshot {
  return {
    session: {
      id: PREVIEW_SESSION_ID,
      mode: 'classic',
      status: 'lobby',
      packName: 'Sunday Warm-Up',
      guestToken: null,
      teamNames: null,
    },
    players: [
      ...PEOPLE.slice(0, 5).map((p) => lobbyPlayer(p)),
      lobbyPlayer(GUEST, null, true),
    ],
    mePlayerId: ME_PLAYER_ID,
    isHost,
  };
}

/** Host view with guest access switched on, so the share link + copy button show. */
export const LOBBY_WITH_GUEST_LINK: LobbySnapshot = {
  ...lobbyClassic(true),
  session: {
    id: PREVIEW_SESSION_ID,
    mode: 'classic',
    status: 'lobby',
    packName: 'Sunday Warm-Up',
    guestToken: 'preview-guest-token-abc123',
    teamNames: null,
  },
};

/** Team Battle host view: two assigned teams plus one unassigned player. */
export const LOBBY_TEAM_BATTLE: LobbySnapshot = {
  session: {
    id: PREVIEW_SESSION_ID,
    mode: 'team_battle',
    status: 'lobby',
    packName: 'Youth Night Trivia',
    guestToken: null,
    teamNames: ['Worship', 'Band'],
  },
  players: [
    lobbyPlayer(PEOPLE[0], 'Worship'),
    lobbyPlayer(PEOPLE[1], 'Worship'),
    lobbyPlayer(PEOPLE[2], 'Band'),
    lobbyPlayer(PEOPLE[3], 'Band'),
    lobbyPlayer(PEOPLE[4], null),
  ],
  mePlayerId: ME_PLAYER_ID,
  isHost: true,
};

/** One lonely player — exercises the "need 2+ players" disabled Start button. */
export const LOBBY_ALONE: LobbySnapshot = {
  ...lobbyClassic(true),
  players: [lobbyPlayer(PEOPLE[0])],
};

// ---------------------------------------------------------------------------
// Live game
// ---------------------------------------------------------------------------

const QUESTION_MC: QuestionPayload = {
  id: 'q2',
  type: 'multiple_choice',
  questionText: 'Who wrote the majority of the Psalms?',
  options: ['David', 'Solomon', 'Moses', 'Asaph'],
  index: 2,
  total: 8,
};

const QUESTION_TF: QuestionPayload = {
  id: 'q3',
  type: 'true_false',
  questionText: 'The word "worship" appears in the book of Genesis.',
  options: ['True', 'False'],
  index: 3,
  total: 8,
};

function board(scores: [Person, number][], extra?: Partial<LeaderboardEntry>): LeaderboardEntry[] {
  return scores
    .slice()
    .sort((a, b) => b[1] - a[1])
    .map(([p, score], i) => ({
      playerId: p.playerId,
      name: p.name,
      isGuest: p.playerId === GUEST.playerId,
      image: p.image,
      score,
      rank: i + 1,
      ...extra,
    }));
}

const CLASSIC_BOARD = board([
  [PEOPLE[0], 1840],
  [PEOPLE[1], 2110],
  [PEOPLE[2], 2450],
  [PEOPLE[3], 1620],
  [PEOPLE[4], 980],
  [GUEST, 1310],
]);

const REVEAL_MC: RoundResultPayload = {
  questionId: 'q2',
  correctAnswer: 'David',
  rows: [
    { playerId: PEOPLE[0].playerId, name: PEOPLE[0].name, answer: 'David', isCorrect: true, pointsEarned: 920, timeTakenMs: 2410 },
    { playerId: PEOPLE[1].playerId, name: PEOPLE[1].name, answer: 'David', isCorrect: true, pointsEarned: 870, timeTakenMs: 3980 },
    { playerId: PEOPLE[2].playerId, name: PEOPLE[2].name, answer: 'Solomon', isCorrect: false, pointsEarned: 0, timeTakenMs: 5120 },
    { playerId: PEOPLE[3].playerId, name: PEOPLE[3].name, answer: 'David', isCorrect: true, pointsEarned: 640, timeTakenMs: 8300 },
    { playerId: PEOPLE[4].playerId, name: PEOPLE[4].name, answer: null, isCorrect: false, pointsEarned: 0, timeTakenMs: null },
    { playerId: GUEST.playerId, name: GUEST.name, answer: 'Moses', isCorrect: false, pointsEarned: 0, timeTakenMs: 6740 },
  ],
};

/**
 * `questionStartAt` is computed at render time so the on-screen countdown is
 * genuinely mid-flight when you open the scene. `secondsElapsed` picks where in
 * the round you land (e.g. 12 of 15 → the final-3s urgent state).
 */
function liveBase(secondsElapsed: number): Pick<GameSnapshot, 'round'> {
  return {
    round: {
      status: 'answering',
      questionStartAt: new Date(Date.now() - secondsElapsed * 1000).toISOString(),
      roundNumber: 3,
    },
  };
}

export function liveAnswering(opts: {
  isHost: boolean;
  secondsElapsed?: number;
  myAnswer?: string | null;
}): GameSnapshot {
  return {
    session: { id: PREVIEW_SESSION_ID, mode: 'classic', status: 'active', timeLimitMs: 15000, total: 8 },
    ...liveBase(opts.secondsElapsed ?? 4),
    question: QUESTION_MC,
    reveal: null,
    me: {
      isHost: opts.isHost,
      player: opts.isHost
        ? null
        : { playerId: ME_PLAYER_ID, hearts: 3, isEliminated: false, isSpectator: false, team: null },
    },
    myAnswer: opts.myAnswer ?? null,
    leaderboard: CLASSIC_BOARD,
    teams: null,
  };
}

/** Final seconds of the timer — the urgent countdown state. */
export const LIVE_FINAL_SECONDS = () => liveAnswering({ isHost: false, secondsElapsed: 12 });

/** Answer submitted, waiting on everyone else (answer locked in). */
export const LIVE_ANSWER_LOCKED = () => liveAnswering({ isHost: false, myAnswer: 'David' });

/** True/False question layout — two big buttons instead of four. */
export function liveTrueFalse(): GameSnapshot {
  return { ...liveAnswering({ isHost: false }), question: QUESTION_TF };
}

/** Reveal, from the perspective of a player who got it RIGHT. */
export function liveRevealCorrect(): GameSnapshot {
  return {
    ...liveAnswering({ isHost: false }),
    round: { status: 'revealing', questionStartAt: null, roundNumber: 3 },
    reveal: REVEAL_MC,
    myAnswer: 'David',
  };
}

/** Reveal, from the perspective of a player who got it WRONG. */
export function liveRevealWrong(): GameSnapshot {
  const snap = liveRevealCorrect();
  return {
    ...snap,
    me: {
      isHost: false,
      player: { playerId: PEOPLE[2].playerId, hearts: 3, isEliminated: false, isSpectator: false, team: null },
    },
    myAnswer: 'Solomon',
  };
}

/** Host mid-reveal: the "Next question" control should be showing. */
export function liveRevealHost(): GameSnapshot {
  return {
    ...liveRevealCorrect(),
    me: { isHost: true, player: null },
    myAnswer: null,
  };
}

// --- Survival -------------------------------------------------------------

const SURVIVAL_BOARD: LeaderboardEntry[] = [
  { playerId: PEOPLE[0].playerId, name: PEOPLE[0].name, isGuest: false, image: PEOPLE[0].image, score: 1840, rank: 1, hearts: 1, isEliminated: false },
  { playerId: PEOPLE[1].playerId, name: PEOPLE[1].name, isGuest: false, image: PEOPLE[1].image, score: 1610, rank: 2, hearts: 3, isEliminated: false },
  { playerId: PEOPLE[2].playerId, name: PEOPLE[2].name, isGuest: false, image: PEOPLE[2].image, score: 1200, rank: 3, hearts: 2, isEliminated: false },
  { playerId: PEOPLE[3].playerId, name: PEOPLE[3].name, isGuest: false, image: PEOPLE[3].image, score: 640, rank: 4, hearts: 0, isEliminated: true },
  { playerId: PEOPLE[4].playerId, name: PEOPLE[4].name, isGuest: false, image: PEOPLE[4].image, score: 410, rank: 5, hearts: 0, isEliminated: true },
];

/** Survival with the viewer down to their LAST heart. */
export function liveSurvivalLastHeart(): GameSnapshot {
  return {
    session: { id: PREVIEW_SESSION_ID, mode: 'survival', status: 'active', timeLimitMs: 15000, total: 8 },
    ...liveBase(6),
    question: QUESTION_MC,
    reveal: null,
    me: {
      isHost: false,
      player: { playerId: ME_PLAYER_ID, hearts: 1, isEliminated: false, isSpectator: false, team: null },
    },
    myAnswer: null,
    leaderboard: SURVIVAL_BOARD,
    teams: null,
  };
}

/** Survival after elimination — the viewer is now a spectator. */
export function liveSurvivalEliminated(): GameSnapshot {
  const snap = liveSurvivalLastHeart();
  return {
    ...snap,
    me: {
      isHost: false,
      player: { playerId: ME_PLAYER_ID, hearts: 0, isEliminated: true, isSpectator: true, team: null },
    },
  };
}

// --- Team Battle ----------------------------------------------------------

const TEAMS: TeamStanding[] = [
  { id: 'team-a', name: 'Worship', teamPoints: 4, individualSum: 5210 },
  { id: 'team-b', name: 'Band', teamPoints: 3, individualSum: 4980 },
];

export function liveTeamBattle(): GameSnapshot {
  return {
    session: { id: PREVIEW_SESSION_ID, mode: 'team_battle', status: 'active', timeLimitMs: 20000, total: 12 },
    ...liveBase(7),
    question: QUESTION_MC,
    reveal: null,
    me: {
      isHost: false,
      player: { playerId: ME_PLAYER_ID, hearts: 3, isEliminated: false, isSpectator: false, team: 'Worship' },
    },
    myAnswer: null,
    leaderboard: board([
      [PEOPLE[0], 1840],
      [PEOPLE[1], 3370],
      [PEOPLE[2], 2450],
      [PEOPLE[3], 2530],
    ]).map((e, i) => ({ ...e, team: i % 2 === 0 ? 'Worship' : 'Band' })),
    teams: TEAMS,
  };
}

/** Between rounds — the short breather the host controls. */
export function liveBetweenRounds(): GameSnapshot {
  return {
    ...liveAnswering({ isHost: true }),
    round: { status: 'between_rounds', questionStartAt: null, roundNumber: 3 },
    question: null,
    reveal: null,
  };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export const RESULTS_CLASSIC: FinalResultPayload = {
  mode: 'classic',
  podium: [
    { place: 1, playerId: PEOPLE[2].playerId, name: PEOPLE[2].name, isGuest: false, image: PEOPLE[2].image, score: 2450 },
    { place: 2, playerId: PEOPLE[1].playerId, name: PEOPLE[1].name, isGuest: false, image: PEOPLE[1].image, score: 2110 },
    { place: 3, playerId: PEOPLE[0].playerId, name: PEOPLE[0].name, isGuest: false, image: PEOPLE[0].image, score: 1840 },
  ],
  rankings: CLASSIC_BOARD,
  winnerPlayerIds: [PEOPLE[2].playerId],
};

export const RESULTS_TEAM: FinalResultPayload = {
  mode: 'team_battle',
  podium: [
    { place: 1, playerId: PEOPLE[1].playerId, name: PEOPLE[1].name, isGuest: false, image: PEOPLE[1].image, score: 3370 },
    { place: 2, playerId: PEOPLE[3].playerId, name: PEOPLE[3].name, isGuest: false, image: PEOPLE[3].image, score: 2530 },
    { place: 3, playerId: PEOPLE[2].playerId, name: PEOPLE[2].name, isGuest: false, image: PEOPLE[2].image, score: 2450 },
  ],
  rankings: board([
    [PEOPLE[1], 3370],
    [PEOPLE[3], 2530],
    [PEOPLE[2], 2450],
    [PEOPLE[0], 1840],
  ]).map((e, i) => ({ ...e, team: i % 2 === 0 ? 'Worship' : 'Band' })),
  teams: TEAMS,
  winnerPlayerIds: [PEOPLE[1].playerId],
};

export const RESULTS_SURVIVAL: FinalResultPayload = {
  mode: 'survival',
  podium: [
    { place: 1, playerId: PEOPLE[1].playerId, name: PEOPLE[1].name, isGuest: false, image: PEOPLE[1].image, score: 1610 },
    { place: 2, playerId: PEOPLE[2].playerId, name: PEOPLE[2].name, isGuest: false, image: PEOPLE[2].image, score: 1200 },
    { place: 3, playerId: PEOPLE[0].playerId, name: PEOPLE[0].name, isGuest: false, image: PEOPLE[0].image, score: 1840 },
  ],
  rankings: SURVIVAL_BOARD,
  eliminationOrder: [
    { playerId: PEOPLE[4].playerId, name: PEOPLE[4].name, hearts: 0 },
    { playerId: PEOPLE[3].playerId, name: PEOPLE[3].name, hearts: 0 },
    { playerId: PEOPLE[0].playerId, name: PEOPLE[0].name, hearts: 0 },
    { playerId: PEOPLE[2].playerId, name: PEOPLE[2].name, hearts: 2 },
    { playerId: PEOPLE[1].playerId, name: PEOPLE[1].name, hearts: 3 },
  ],
  winnerPlayerIds: [PEOPLE[1].playerId],
};

/** A dead-even finish — exercises the documented "all tied players win" path. */
export const RESULTS_TIE: FinalResultPayload = {
  mode: 'classic',
  podium: [
    { place: 1, playerId: PEOPLE[2].playerId, name: PEOPLE[2].name, isGuest: false, image: PEOPLE[2].image, score: 2450 },
    { place: 1, playerId: PEOPLE[1].playerId, name: PEOPLE[1].name, isGuest: false, image: PEOPLE[1].image, score: 2450 },
    { place: 3, playerId: PEOPLE[0].playerId, name: PEOPLE[0].name, isGuest: false, image: PEOPLE[0].image, score: 1840 },
  ],
  rankings: board([
    [PEOPLE[2], 2450],
    [PEOPLE[1], 2450],
    [PEOPLE[0], 1840],
  ]),
  winnerPlayerIds: [PEOPLE[2].playerId, PEOPLE[1].playerId],
};
