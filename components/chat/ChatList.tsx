'use client';

import { useCallback, useRef, useState } from 'react';
import type { ChatListDTO, ChatListItemDTO } from '@/lib/chat/types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/EmptyState';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { listCard } from '@/lib/ui-classes';
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
    <div className="space-y-6">
      <ScreenHeader
        eyebrow="GNW Hub"
        title="Chat"
        className="mb-0"
        actions={
          <>
            {data.chats.length > 0 && (
              <button
                type="button"
                className="glass grid h-11 w-11 place-items-center rounded-full text-ink-soft transition-transform duration-150 active:scale-[0.97]"
                onClick={() => {
                  setSearchMounted(true);
                  setSearching(true);
                }}
                aria-label="Search all chats"
              >
                <Search width={20} height={20} />
              </button>
            )}
            {canCreate && (
              <button type="button" className="btn-primary btn-sm h-11" onClick={() => setCreating(true)}>
                <Plus width={16} height={16} /> New
              </button>
            )}
          </>
        }
      />

      {data.chats.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          message={canCreate ? 'No chats yet. Start one for your team!' : 'You’re not in any chats yet. A leader will add you.'}
        />
      ) : (
        <ul className={listCard}>
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
            <ul className={cn(listCard, 'opacity-80')}>
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
