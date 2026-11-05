'use client';

import { useCallback, useRef, useState } from 'react';
import type { ChatListDTO, ChatListItemDTO } from '@/lib/chat/types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/EmptyState';
import { ChevronDown, MessageCircle, Plus, Search } from '@/components/shared/Icons';
import { useChatSignals } from './ChatProvider';
import { ChatSearch } from './ChatSearch';
import { NewChatSheet } from './NewChatSheet';
import { ChatRow, ChatTile, chatHref, newestMessage, totalUnread } from './ChatRow';

/**
 * The Chat tab — like opening GroupMe: every chat you're in, newest activity
 * first. A chat with topics opens its own page (Main chat + topics); one
 * without opens straight into the conversation. Refreshes itself on any chat
 * ping and when the app comes back to the front.
 */
export function ChatList({
  base,
  meId,
  initial,
  canCreate,
}: {
  base: '/home' | '/dashboard';
  meId: string;
  initial: ChatListDTO;
  canCreate: boolean;
}) {
  const [data, setData] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchMounted, setSearchMounted] = useState(false);
  const timer = useRef<number | null>(null);

  const refresh = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        setData(await apiFetch<ChatListDTO>('/api/chat'));
      } catch {
        /* offline — keep what's shown */
      }
    }, 250);
  }, []);
  useChatSignals(refresh);

  return (
    <div className="space-y-5 pt-2">
      <header className="flex items-end justify-between gap-3 pr-12">
        <h1 className="page-title">Chat</h1>
        <div className="flex shrink-0 items-center gap-1">
          {data.chats.length > 0 && (
            <button
              type="button"
              className="row-press grid h-10 w-10 place-items-center rounded-xl text-ink-soft"
              onClick={() => {
                setSearchMounted(true);
                setSearching(true);
              }}
              aria-label="Search all chats"
            >
              <Search width={21} height={21} />
            </button>
          )}
          {canCreate && (
            <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={() => setCreating(true)}>
              <Plus width={16} height={16} /> New chat
            </button>
          )}
        </div>
      </header>

      {data.chats.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          message={canCreate ? 'No chats yet. Start one for your team!' : 'You’re not in any chats yet. A leader will add you.'}
        />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {data.chats.map((c) => (
            <li key={c.id}>
              <ListRow base={base} item={c} />
            </li>
          ))}
        </ul>
      )}

      {data.archived.length > 0 && (
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-1 text-sm font-semibold text-ink-soft"
            aria-expanded={showArchived}
          >
            <ChevronDown width={16} height={16} className={cn('transition-transform', !showArchived && '-rotate-90')} />
            Archived ({data.archived.length})
          </button>
          {showArchived && (
            <ul className="card divide-y divide-line overflow-hidden opacity-80">
              {data.archived.map((c) => (
                <li key={c.id}>
                  <ListRow base={base} item={c} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {creating && <NewChatSheet base={base} meId={meId} onClose={() => setCreating(false)} />}
      {searchMounted && <ChatSearch base={base} open={searching} chat={null} onClose={() => setSearching(false)} />}
    </div>
  );
}

/** One chat in the list. Topics don't get rows here — they live on the chat's page — but their unread counts roll up into this badge. */
function ListRow({ base, item }: { base: string; item: ChatListItemDTO }) {
  return (
    <ChatRow
      href={chatHref(base, item)}
      tile={<ChatTile name={item.name} stacked={item.topics.length > 0} />}
      name={item.name}
      last={newestMessage(item)}
      unread={totalUnread(item)}
      muted={item.muted}
      showMutedIcon
    />
  );
}
