'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { apiFetch } from '@/lib/api-client';
import { CHAT_PING_EVENT, type ChatPing } from '@/lib/chat/types';

/**
 * A realtime ping, or `resync`: the socket (re)connected or the app came back
 * to the foreground — iPhone home-screen apps drop sockets in the background,
 * so anything could have been missed. Listeners refetch from the API either way.
 */
export type ChatSignal = ChatPing | { kind: 'resync' };

type Ctx = {
  unreadTotal: number;
  refreshUnread: () => void;
  subscribe: (fn: (s: ChatSignal) => void) => () => void;
};

const ChatContext = createContext<Ctx | null>(null);

/**
 * The app's one chat subscription (mounted in AppShell). Listens on the
 * signed-in user's private ping topic and fans each ping out to whatever chat
 * screen is open, and keeps the nav badge total fresh. Pings carry no content
 * — see lib/chat/realtime-server.ts.
 */
export function ChatProvider({ topic, children }: { topic: string; children: ReactNode }) {
  const [unreadTotal, setUnreadTotal] = useState(0);
  const listeners = useRef(new Set<(s: ChatSignal) => void>());
  const unreadTimer = useRef<number | null>(null);

  const emit = useCallback((s: ChatSignal) => {
    for (const fn of listeners.current) fn(s);
  }, []);

  const refreshUnread = useCallback(() => {
    if (unreadTimer.current) window.clearTimeout(unreadTimer.current);
    // Debounced: a burst of pings costs one fetch.
    unreadTimer.current = window.setTimeout(async () => {
      try {
        const { unreadTotal } = await apiFetch<{ unreadTotal: number }>('/api/chat/unread');
        setUnreadTotal(unreadTotal);
      } catch {
        /* offline — keep the last count */
      }
    }, 300);
  }, []);

  const subscribe = useCallback((fn: (s: ChatSignal) => void) => {
    listeners.current.add(fn);
    return () => void listeners.current.delete(fn);
  }, []);

  useEffect(() => {
    refreshUnread();
    const supabase = getSupabaseBrowser();
    let joinedOnce = false;
    const channel = supabase
      .channel(topic)
      .on('broadcast', { event: CHAT_PING_EVENT }, (msg) => {
        emit(msg.payload as ChatPing);
        refreshUnread();
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        // The first join is the page load (already fresh); later ones are reconnects.
        if (joinedOnce) {
          emit({ kind: 'resync' });
          refreshUnread();
        }
        joinedOnce = true;
      });

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      emit({ kind: 'resync' });
      refreshUnread();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [topic, emit, refreshUnread]);

  // Mirror the count onto the home-screen icon where the Badging API exists
  // (installed PWAs with notification permission). Best-effort.
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (unreadTotal > 0) nav.setAppBadge?.(unreadTotal).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [unreadTotal]);

  return <ChatContext.Provider value={{ unreadTotal, refreshUnread, subscribe }}>{children}</ChatContext.Provider>;
}

export function useChat(): Ctx {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>');
  return ctx;
}

/** Run `fn` for every chat signal while mounted (the latest `fn` is always used). */
export function useChatSignals(fn: (s: ChatSignal) => void) {
  const { subscribe } = useChat();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => subscribe((s) => ref.current(s)), [subscribe]);
}

/** Nav badge total — safe outside the provider (returns 0). */
export function useChatUnreadTotal(): number {
  return useContext(ChatContext)?.unreadTotal ?? 0;
}
