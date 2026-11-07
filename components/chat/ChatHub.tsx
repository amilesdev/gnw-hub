'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ChatDetailDTO, ChatListDTO, ChatListItemDTO } from '@/lib/chat/types';
import { apiFetch } from '@/lib/api-client';
import { BellOff, ChevronLeft, MoreHorizontal, Plus, Search } from '@/components/shared/Icons';
import { useChatSignals } from './ChatProvider';
import { ChatSearch } from './ChatSearch';
import { ChatSettingsSheet } from './ChatSettingsSheet';
import { ChatRow, ChatTile, IconTile, MainChatTile } from './ChatRow';
import { NewTopicSheet } from './NewTopicSheet';

/**
 * A chat's own page, for chats that have topics (GroupMe's group screen): the
 * chat's name up top, then "Main chat", then each topic, then "+ New topic"
 * for those who can make one. Full screen over the tab bar, like the
 * conversation it leads into.
 */
export function ChatHub({
  base,
  meId,
  initialItem,
  initialDetail,
}: {
  base: '/home' | '/dashboard';
  meId: string;
  initialItem: ChatListItemDTO;
  initialDetail: ChatDetailDTO;
}) {
  const router = useRouter();
  const [item, setItem] = useState(initialItem);
  const [detail, setDetail] = useState(initialDetail);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchMounted, setSearchMounted] = useState(false);
  const timer = useRef<number | null>(null);

  const refresh = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        const list = await apiFetch<ChatListDTO>('/api/chat');
        const next = [...list.chats, ...list.archived].find((c) => c.id === item.id);
        if (!next) return router.replace(`${base}/chat`);
        // Last topic archived away → this page has nothing to choose between.
        if (next.topics.length === 0) return router.replace(`${base}/chat/${item.id}`);
        setItem(next);
      } catch {
        /* offline — keep what's shown */
      }
    }, 250);
  }, [base, item.id, router]);

  const reloadDetail = useCallback(async () => {
    try {
      setDetail((await apiFetch<{ chat: ChatDetailDTO }>(`/api/chat/${item.id}`)).chat);
    } catch {
      router.replace(`${base}/chat`);
    }
  }, [base, item.id, router]);

  useChatSignals((s) => {
    refresh();
    if (s.kind === 'resync' || (s.kind === 'chats' && s.chatId === item.id)) void reloadDetail();
  });

  return (
    <div className="fixed inset-0 z-[45] flex flex-col bg-app">
      {/* The same fading top wash as every other screen, not a solid band. */}
      <div className="app-wash" aria-hidden />
      <header
        className="relative flex shrink-0 items-center justify-between px-3 pb-1"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        <Link
          href={`${base}/chat`}
          replace
          className="btn-icon"
          aria-label="Back to chats"
        >
          <ChevronLeft width={22} height={22} />
        </Link>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => {
              setSearchMounted(true);
              setSearching(true);
            }}
            className="btn-icon"
            aria-label={`Search ${item.name}`}
          >
            <Search width={20} height={20} />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="btn-icon"
            aria-label="Chat settings"
          >
            <MoreHorizontal width={22} height={22} />
          </button>
        </div>
      </header>

      <div className="no-scrollbar relative flex-1 overflow-y-auto overscroll-contain pb-10">
        <div className="flex flex-col items-center px-6 pb-5 pt-1 text-center">
          <ChatTile name={item.name} size="lg" />
          <h1 className="mt-3 flex items-center gap-2 font-display text-[1.75rem] font-semibold leading-tight">
            {item.name}
            {item.muted && <BellOff width={18} height={18} className="text-ink-faint" aria-label="Muted" />}
          </h1>
          <p className="mt-1 text-sm text-ink-faint">
            {detail.members.length} {detail.members.length === 1 ? 'member' : 'members'}
          </p>
        </div>

        <ChatRow
          href={`${base}/chat/${item.id}`}
          tile={<MainChatTile />}
          name="Main chat"
          last={item.lastMessage}
          unread={item.unread}
          muted={item.muted}
        />

        <div className="flex items-center gap-3 px-4 pb-1 pt-4">
          <span className="text-sm font-semibold text-ink-faint">Topics</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <ul>
          {item.topics.map((t) => (
            <li key={t.id}>
              <ChatRow
                href={`${base}/chat/${t.id}`}
                tile={<IconTile>#</IconTile>}
                name={t.name}
                last={t.lastMessage}
                unread={t.unread}
                muted={item.muted}
              />
            </li>
          ))}
        </ul>

        {detail.can.createTopic && (
          <div className="px-4 pt-4">
            <button type="button" className="btn-ghost w-full py-3.5" onClick={() => setCreating(true)}>
              <Plus width={18} height={18} /> New topic
            </button>
          </div>
        )}
      </div>

      {settingsOpen && (
        <ChatSettingsSheet
          base={base}
          meId={meId}
          detail={detail}
          onChange={(d) => {
            setDetail(d);
            refresh();
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {searchMounted && (
        <ChatSearch
          base={base}
          open={searching}
          chat={{ id: item.id, name: item.name }}
          onClose={() => setSearching(false)}
        />
      )}
      {creating && (
        <NewTopicSheet
          chatId={item.id}
          onClose={() => setCreating(false)}
          onCreated={(id) => router.push(`${base}/chat/${id}`)}
        />
      )}
    </div>
  );
}

