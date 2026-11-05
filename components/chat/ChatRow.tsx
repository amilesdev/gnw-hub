import Link from 'next/link';
import type { ReactNode } from 'react';
import { mediaLabel, type ChatLastMessageDTO, type ChatListItemDTO } from '@/lib/chat/types';
import { cn } from '@/lib/utils';
import { BellOff, MessageCircle } from '@/components/shared/Icons';
import { formatListStamp } from './format';

/** Where a chat-list row goes: a chat with topics opens its page (Main chat + topics); otherwise straight in. */
export function chatHref(base: string, item: ChatListItemDTO): string {
  return item.topics.length > 0 ? `${base}/chat/${item.id}/topics` : `${base}/chat/${item.id}`;
}

/** A chat's own unread plus all its topics'. */
export function totalUnread(item: ChatListItemDTO): number {
  return item.unread + item.topics.reduce((n, t) => n + t.unread, 0);
}

/** The newest message across a chat and its topics (what the chat list previews). */
export function newestMessage(item: ChatListItemDTO): ChatLastMessageDTO | null {
  let best = item.lastMessage;
  for (const t of item.topics) {
    if (t.lastMessage && (!best || t.lastMessage.createdAt > best.createdAt)) best = t.lastMessage;
  }
  return best;
}

export function previewText(m: ChatLastMessageDTO | null): string | null {
  if (!m) return null;
  const who = m.authorName ? `${m.authorName.split(' ')[0]}: ` : '';
  if (m.deleted) return `${who}Message deleted`;
  return `${who}${(m.text ?? mediaLabel(m.media)).replace(/\s+/g, ' ')}`;
}

const tileClass = 'grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white';
const sage = { background: 'linear-gradient(150deg, #5E7048, #3c4a2c)' };

/** A chat's tile: its initial on sage. `stacked` adds the card edge GroupMe uses to say "has topics". */
export function ChatTile({ name, stacked = false, size = 'md' }: { name: string; stacked?: boolean; size?: 'md' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <span className={cn('relative shrink-0', lg ? 'h-20 w-20' : 'h-12 w-12')} aria-hidden>
      {stacked && <span className={cn('absolute inset-y-1 -right-1.5 rounded-2xl bg-ink-faint/35', lg ? 'w-20' : 'w-12')} />}
      <span
        className={cn(tileClass, 'relative font-display font-semibold', lg ? 'h-20 w-20 rounded-3xl text-3xl' : 'text-lg')}
        style={sage}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    </span>
  );
}

/** Gray tile for "Main chat" / a topic on a chat's page. */
export function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className={cn(tileClass, 'bg-ink-faint/80 font-display text-2xl font-semibold')} aria-hidden>
      {children}
    </span>
  );
}

export function MainChatTile() {
  return (
    <IconTile>
      <MessageCircle width={24} height={24} />
    </IconTile>
  );
}

/** One row: tile, name, preview, time, unread badge (gray when muted). */
export function ChatRow({
  href,
  tile,
  name,
  last,
  unread,
  muted,
  showMutedIcon = false,
}: {
  href: string;
  tile: ReactNode;
  name: string;
  last: ChatLastMessageDTO | null;
  unread: number;
  muted: boolean;
  showMutedIcon?: boolean;
}) {
  const preview = previewText(last);
  const has = unread > 0;
  return (
    <Link href={href} className="row-press flex items-center gap-3 px-4 py-3">
      {tile}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={cn('truncate text-base', has ? 'font-bold' : 'font-semibold')}>{name}</span>
          {showMutedIcon && muted && <BellOff width={14} height={14} className="shrink-0 text-ink-faint" aria-label="Muted" />}
        </span>
        <span className={cn('mt-0.5 block truncate text-sm', has ? 'text-ink' : 'text-ink-soft')}>
          {preview ?? 'No messages yet'}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1 self-start pt-0.5">
        {last && (
          <span className="text-xs text-ink-faint" suppressHydrationWarning>
            {formatListStamp(last.createdAt)}
          </span>
        )}
        {has && (
          <span
            className={cn(
              'grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold leading-none text-white',
              muted ? 'bg-ink-faint' : 'bg-unread',
            )}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </span>
    </Link>
  );
}
