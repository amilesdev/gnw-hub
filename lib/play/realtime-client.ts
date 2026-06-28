'use client';

import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { GameEvent } from './types';

// Mirror of realtime-server constants (kept here so client code never imports a
// `server-only` module).
export function gameTopic(sessionId: string): string {
  return `game:${sessionId}`;
}
export const GAME_EVENT = 'game_event';

/**
 * Subscribe to a session's GameEvents. The handler is kept in a ref so the
 * channel is created once per sessionId and survives handler identity changes.
 */
export function useGameChannel(
  sessionId: string | null,
  onEvent: (e: GameEvent) => void,
): RealtimeChannel | null {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(gameTopic(sessionId), { config: { broadcast: { self: true } } })
      .on('broadcast', { event: GAME_EVENT }, (msg) => {
        handlerRef.current(msg.payload as GameEvent);
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId]);

  return channelRef.current;
}

/**
 * Send an emoji reaction. Routed through the server (which re-broadcasts to all
 * subscribers, including the sender) rather than client→channel, since sending
 * on a not-yet-subscribed channel is dropped silently.
 */
export function sendReaction(sessionId: string, emoji: string, playerId: string): void {
  void fetch('/api/play/react', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, emoji, playerId }),
  }).catch(() => {});
}
