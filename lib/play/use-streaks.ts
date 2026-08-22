'use client';

import { useCallback, useRef, useState } from 'react';
import type { RoundResultPayload } from './types';

/** A streak has to reach this before it's worth showing. */
export const STREAK_MIN = 2;
/** At this length it's running hot — the chip ignites. */
export const STREAK_HOT = 4;

/**
 * Consecutive correct answers, per player.
 *
 * Computed on the client from the ROUND_RESULTS broadcast rather than stored on
 * the server, because every client already receives every player's row for
 * every round — the information is there, nobody was reading it. That keeps
 * this a pure display layer: streaks show momentum, they do not change scoring.
 * (Awarding streak bonuses would be a scoring-engine change, not this.)
 *
 * A player who joins mid-game simply starts counting from the round they saw,
 * which is the honest answer — they didn't witness the earlier ones.
 */
export function useStreaks() {
  const counts = useRef(new Map<string, number>());
  const [streaks, setStreaks] = useState<Map<string, number>>(new Map());

  const record = useCallback((reveal: RoundResultPayload) => {
    const next = new Map(counts.current);
    for (const row of reveal.rows) {
      next.set(row.playerId, row.isCorrect ? (next.get(row.playerId) ?? 0) + 1 : 0);
    }
    counts.current = next;
    setStreaks(next);
  }, []);

  const reset = useCallback(() => {
    counts.current = new Map();
    setStreaks(new Map());
  }, []);

  return { streaks, record, reset };
}
