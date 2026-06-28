// GNW Play — shared types for the live game. The server is the single source of
// truth; these payloads are what the server broadcasts to clients over Supabase
// Realtime. Correct answers are NEVER sent during `answering` — only on reveal.

export type QuestionType = 'multiple_choice' | 'true_false';
export type GameMode = 'classic' | 'team_battle' | 'survival';
export type SessionStatus = 'lobby' | 'active' | 'ended';
export type RoundStatus = 'answering' | 'revealing' | 'between_rounds';

export interface GameSettings {
  time_per_question: number; // seconds, 5–60
  shuffle: boolean;
  team_names?: [string, string]; // team_battle only
}

// The question as shown to players mid-round — deliberately omits correctAnswer.
export interface QuestionPayload {
  id: string;
  type: QuestionType;
  questionText: string;
  options: string[];
  index: number; // position within question_order
  total: number; // total questions this game
}

export interface RoundResultRow {
  playerId: string;
  name: string;
  answer: string | null; // null = did not answer
  isCorrect: boolean;
  pointsEarned: number;
  timeTakenMs: number | null;
  heartsLost?: number; // survival
  hearts?: number; // survival, remaining after this round
}

export interface RoundResultPayload {
  questionId: string;
  correctAnswer: string;
  rows: RoundResultRow[];
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  isGuest: boolean;
  score: number;
  rank: number;
  team?: string | null;
  hearts?: number; // survival
  isEliminated?: boolean; // survival
}

export interface TeamStanding {
  id: string;
  name: string;
  teamPoints: number;
  individualSum: number;
}

export interface PodiumEntry {
  place: 1 | 2 | 3;
  playerId: string;
  name: string;
  isGuest: boolean;
  score: number;
}

export interface FinalResultPayload {
  mode: GameMode;
  podium: PodiumEntry[];
  rankings: LeaderboardEntry[];
  teams?: TeamStanding[];
  // survival: order players were eliminated (first → last); winner(s) last.
  eliminationOrder?: { playerId: string; name: string; hearts: number }[];
  winnerPlayerIds: string[];
}

// Strict event schema broadcast on channel `game:${sessionId}` (spec §5.1).
export type GameEvent =
  | { type: 'GAME_STARTING'; countdown: number }
  | { type: 'QUESTION_START'; questionIndex: number; question: QuestionPayload; questionStartAt: string; timeLimitMs: number }
  | { type: 'ANSWER_LOCKED'; playerId: string }
  | { type: 'ROUND_RESULTS'; results: RoundResultPayload }
  | { type: 'LEADERBOARD_UPDATE'; leaderboard: LeaderboardEntry[]; teams?: TeamStanding[] }
  | { type: 'GAME_PAUSED' }
  | { type: 'GAME_RESUMED' }
  | { type: 'GAME_ENDED'; finalResults: FinalResultPayload }
  | { type: 'PLAYER_REMOVED'; playerId: string }
  | { type: 'REACTION'; emoji: string; playerId: string }
  | { type: 'SURVIVAL_ELIMINATION'; playerId: string }
  // Lobby roster changed (join/leave/team assignment) — clients refetch the
  // roster. Not in the original spec union; added so the lobby roster (which is
  // DB-authoritative, not just presence) updates instantly without polling lag.
  | { type: 'LOBBY_UPDATE' }
  // Host hit "Play Again" — clients on the results screen jump to the new lobby.
  | { type: 'PLAY_AGAIN'; sessionId: string };

export interface LobbyPlayer {
  id: string;
  name: string;
  isGuest: boolean;
  team: string | null;
}

export interface PlayerSelfState {
  playerId: string;
  hearts: number;
  isEliminated: boolean;
  isSpectator: boolean;
  team: string | null;
}

// Full state for (re)hydrating a live-game client on mount/reconnect. After
// mount the client is driven by Realtime GameEvents.
export interface GameSnapshot {
  session: {
    id: string;
    mode: GameMode;
    status: SessionStatus;
    timeLimitMs: number;
    total: number;
  };
  round: { status: RoundStatus; questionStartAt: string | null; roundNumber: number };
  question: QuestionPayload | null; // present while answering/revealing
  reveal: RoundResultPayload | null; // present once revealed
  me: { isHost: boolean; player: PlayerSelfState | null };
  myAnswer: string | null; // my submitted answer for the current question
  leaderboard: LeaderboardEntry[];
  teams: TeamStanding[] | null;
}

export interface LobbySnapshot {
  session: {
    id: string;
    mode: GameMode;
    status: SessionStatus;
    packName: string;
    guestToken: string | null;
    teamNames: [string, string] | null;
  };
  players: LobbyPlayer[];
  mePlayerId: string | null;
  isHost: boolean;
}
