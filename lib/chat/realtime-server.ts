import 'server-only';
import { createHmac } from 'node:crypto';
import { CHAT_PING_EVENT, type ChatPing } from './types';

// Chat realtime — content-free pings only (see Docs/Chat-Feature.md → Realtime).
//
// Supabase Realtime topics here are PUBLIC (the anon key is in every browser),
// so the only protection is that a topic name can't be guessed: each user gets
// one topic named by an HMAC of their id under NEXTAUTH_SECRET. A ping carries
// ids and a kind — never message text — and the client then refetches through
// our API, which checks membership. One topic per user (not per chat) means the
// app holds a single subscription that drives the chat list, the open chat and
// the nav badge alike.

export function chatUserTopic(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? '';
  const key = createHmac('sha256', secret).update(`chat-user:${userId}`).digest('hex').slice(0, 40);
  return `chat-u:${key}`;
}

/**
 * Ping each user's topic. Best-effort, like Play's broadcast: the DB is already
 * the truth, and clients catch up on reconnect/resume. One HTTP call for all.
 */
export async function pingUsers(userIds: string[], ping: ChatPing): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key || userIds.length === 0) return;

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        messages: [...new Set(userIds)].map((id) => ({
          topic: chatUserTopic(id),
          event: CHAT_PING_EVENT,
          payload: ping,
          private: false,
        })),
      }),
    });
  } catch {
    // swallow — see note above
  }
}
