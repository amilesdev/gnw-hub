import 'server-only';
import type { GameEvent } from './types';

// Realtime channel for a session. Clients subscribe to this topic; the server
// pushes GameEvents to it after every authoritative DB write.
export function gameTopic(sessionId: string): string {
  return `game:${sessionId}`;
}

// Single broadcast event name carrying the typed GameEvent union as payload, so
// clients register one handler over a discriminated union.
export const GAME_EVENT = 'game_event';

// Broadcast a GameEvent from the server via Supabase Realtime's HTTP endpoint.
// Uses the service-role key (bypasses channel authorization). Best-effort: a
// transport failure never corrupts game state — the DB is already the truth, and
// clients reconcile via the snapshot API on (re)connect.
export async function broadcast(sessionId: string, event: GameEvent): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) return;

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [{ topic: gameTopic(sessionId), event: GAME_EVENT, payload: event, private: false }],
      }),
    });
  } catch {
    // swallow — see note above
  }
}
