'use client';

import { Fragment, useRef, type ReactNode } from 'react';
import type { ChatAttachmentDTO, ChatMessageDTO } from '@/lib/chat/types';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { MoreHorizontal, Pin, Play } from '@/components/shared/Icons';
import { ChatAvatar } from './ChatAvatar';
import { dayKey, formatDayDivider, formatTime, linkify } from './format';
import { formatDuration } from './media';

/** A message as the open chat holds it: confirmed, or the sender's optimistic copy. */
export type ClientMessage = ChatMessageDTO & { pending?: boolean; failed?: boolean };

/** Consecutive messages from one person within this window share a group. */
const GROUP_GAP_MS = 5 * 60_000;
const LONG_PRESS_MS = 420;

const authorKey = (m: ChatMessageDTO) => m.author?.id ?? `former:${m.importedAuthorName ?? ''}`;

function sameGroup(a: ChatMessageDTO | undefined, b: ChatMessageDTO | undefined): boolean {
  return (
    !!a &&
    !!b &&
    authorKey(a) === authorKey(b) &&
    dayKey(a.createdAt) === dayKey(b.createdAt) &&
    Math.abs(Date.parse(b.createdAt) - Date.parse(a.createdAt)) < GROUP_GAP_MS &&
    !b.replyTo // a reply starts its own run, so its quote reads clearly
  );
}

export type MessageHandlers = {
  onRetry: (m: ClientMessage) => void;
  onOpenActions: (m: ClientMessage) => void;
  onToggleReaction: (m: ClientMessage, emoji: string) => void;
  onJumpTo: (messageId: string) => void;
  onOpenMedia: (m: ClientMessage, index: number) => void;
};

/**
 * The message column: day dividers, then runs of bubbles grouped by sender.
 * Others get a name on the first bubble of a run and an avatar on the last;
 * the time sits under the last.
 */
export function ChatMessages({
  messages,
  meId,
  memberNames,
  highlightId,
  ...handlers
}: {
  messages: ClientMessage[];
  meId: string;
  /** userId → name, to highlight @mentions in text. */
  memberNames: Map<string, string>;
  highlightId: string | null;
} & MessageHandlers) {
  return (
    <>
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
        const first = newDay || !sameGroup(prev, m);
        const last = !sameGroup(m, next);
        return (
          // Keyed by nonce when there is one, so a sent message keeps its node
          // when the optimistic copy is swapped for the confirmed one.
          <Fragment key={m.clientNonce ?? m.id}>
            {newDay && (
              <div className="flex justify-center py-3">
                <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-ink-soft" suppressHydrationWarning>
                  {formatDayDivider(m.createdAt)}
                </span>
              </div>
            )}
            <Bubble
              message={m}
              mine={m.author?.id === meId}
              meId={meId}
              first={first}
              last={last}
              memberNames={memberNames}
              highlighted={highlightId === m.id}
              {...handlers}
            />
          </Fragment>
        );
      })}
    </>
  );
}

function Bubble({
  message: m,
  mine,
  meId,
  first,
  last,
  memberNames,
  highlighted,
  onRetry,
  onOpenActions,
  onToggleReaction,
  onJumpTo,
  onOpenMedia,
}: {
  message: ClientMessage;
  mine: boolean;
  meId: string;
  first: boolean;
  last: boolean;
  memberNames: Map<string, string>;
  highlighted: boolean;
} & MessageHandlers) {
  const former = !m.author;
  const name = m.author?.name ?? m.importedAuthorName ?? 'Former member';
  const settled = !m.pending && !m.failed;
  const press = useLongPress(() => settled && !m.deleted && onOpenActions(m));
  const hasMedia = m.attachments.length > 0;
  const hasText = !!m.text;
  const mentionsMe = m.mentionsAll || m.mentionIds.includes(meId);

  return (
    <div
      data-mid={m.id}
      className={cn(
        'group flex items-end gap-2 rounded-2xl transition-colors duration-700',
        mine ? 'justify-end' : 'justify-start',
        first ? 'mt-2.5' : 'mt-0.5',
        highlighted && 'bg-unread/15',
      )}
    >
      {!mine && (
        <span className="w-8 shrink-0 self-end">
          {last && <ChatAvatar name={name} image={m.author?.image ?? m.importedAuthorAvatar} size={32} former={former} />}
        </span>
      )}
      {mine && settled && !m.deleted && <HoverMenu onClick={() => onOpenActions(m)} />}

      <div className={cn('flex min-w-0 max-w-[78%] flex-col', mine ? 'items-end' : 'items-start')}>
        {!mine && first && (
          <span className={cn('mb-0.5 ml-3 text-xs font-semibold', former ? 'text-ink-faint' : 'text-ink-soft')}>
            {name}
            {former && <span className="font-normal"> · former member</span>}
          </span>
        )}

        {m.deleted ? (
          <div className="rounded-2xl border border-line px-3.5 py-2 text-[15px] italic text-ink-faint">Message deleted</div>
        ) : (
          <div
            {...press}
            className={cn(
              'select-none overflow-hidden rounded-[1.25rem] text-[15px] leading-snug [-webkit-touch-callout:none]',
              mine ? 'bg-chat-mine text-chat-mine-ink' : 'bg-chat-theirs text-chat-theirs-ink',
              mine ? (last ? 'rounded-br-md' : '') : last ? 'rounded-bl-md' : '',
              hasMedia && !hasText && !m.replyTo && 'bg-transparent',
              mentionsMe && !mine && 'ring-2 ring-unread/70',
              m.pending && 'opacity-60',
              m.failed && 'opacity-60 ring-2 ring-bad/60',
            )}
          >
            {m.replyTo && (
              <button
                type="button"
                onClick={() => onJumpTo(m.replyTo!.id)}
                className={cn(
                  'mx-1.5 mt-1.5 block w-[calc(100%-0.75rem)] min-w-[9rem] rounded-xl border-l-[3px] px-2.5 py-1.5 text-left text-[13px] leading-snug',
                  mine ? 'border-white/70 bg-white/15' : 'border-accent bg-black/5 dark:bg-white/10',
                )}
              >
                <span className="block font-semibold">{m.replyTo.authorName ?? 'Former member'}</span>
                <span className="line-clamp-2 opacity-80">
                  {m.replyTo.deleted ? 'Message deleted' : m.replyTo.text || (m.replyTo.media === 'video' ? 'Video' : 'Photo')}
                </span>
              </button>
            )}
            {hasMedia && <MediaGrid items={m.attachments} padded={hasText || !!m.replyTo} onOpen={(i) => onOpenMedia(m, i)} />}
            {hasText && (
              <div className="whitespace-pre-wrap break-words px-3.5 py-2 [overflow-wrap:anywhere]">
                {renderText(m, memberNames, meId)}
              </div>
            )}
          </div>
        )}

        {m.reactions.length > 0 && !m.deleted && (
          <div className={cn('-mt-1 flex flex-wrap gap-1', mine ? 'mr-2 justify-end' : 'ml-2')}>
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onToggleReaction(m, r.emoji)}
                aria-label={`${r.emoji} ${r.count}: ${r.names.join(', ')}`}
                aria-pressed={r.mine}
                className={cn(
                  'relative inline-flex items-center gap-1 rounded-full border bg-surface px-2 py-0.5 text-xs font-semibold shadow-sm',
                  r.mine ? 'border-accent text-accent dark:text-accent-on' : 'border-line text-ink-soft',
                )}
              >
                <span className="text-sm leading-none">{r.emoji}</span>
                {r.count > 1 && r.count}
              </button>
            ))}
          </div>
        )}

        {m.failed ? (
          <button type="button" onClick={() => onRetry(m)} className="mt-1 text-xs font-semibold text-bad">
            Not sent · Tap to retry
          </button>
        ) : (
          last && (
            <span
              className={cn('mt-1 inline-flex items-center gap-1 text-[11px] text-ink-faint', mine ? 'mr-1' : 'ml-3')}
              suppressHydrationWarning
            >
              {m.pinnedAt && <Pin width={11} height={11} aria-label="Pinned" />}
              {m.pending ? 'Sending…' : formatTime(m.createdAt)}
              {m.editedAt && !m.deleted && ' · edited'}
            </span>
          )
        )}
        {!last && m.pinnedAt && (
          <span className={cn('mt-0.5 inline-flex items-center gap-1 text-[11px] text-ink-faint', mine ? 'mr-1' : 'ml-3')}>
            <Pin width={11} height={11} /> Pinned
          </span>
        )}
      </div>

      {!mine && settled && !m.deleted && <HoverMenu onClick={() => onOpenActions(m)} />}
    </div>
  );
}

/** Desktop only: a "⋯" beside the bubble on hover (phones long-press instead). */
function HoverMenu({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Message actions"
      className="mb-6 hidden h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint opacity-0 transition hover:bg-surface-2 group-hover:opacity-100 [@media(hover:hover)]:grid"
    >
      <MoreHorizontal width={18} height={18} />
    </button>
  );
}

function MediaGrid({ items, padded, onOpen }: { items: ChatAttachmentDTO[]; padded: boolean; onOpen: (i: number) => void }) {
  const shown = items.slice(0, 4);
  const extra = items.length - shown.length;
  if (items.length === 1) {
    const a = items[0];
    const ratio = a.width && a.height ? Math.min(1.6, Math.max(0.6, a.width / a.height)) : 1;
    return (
      <button type="button" onClick={() => onOpen(0)} className={cn('relative block w-[15rem] max-w-full', padded && 'p-1')}>
        <MediaThumb a={a} className="w-full rounded-[1rem]" style={{ aspectRatio: String(ratio) }} />
      </button>
    );
  }
  return (
    <div className={cn('grid w-[15rem] max-w-full grid-cols-2 gap-0.5', padded && 'p-1')}>
      {shown.map((a, i) => (
        <button key={a.id} type="button" onClick={() => onOpen(i)} className="relative aspect-square overflow-hidden first:rounded-tl-[1rem] [&:nth-child(2)]:rounded-tr-[1rem]">
          <MediaThumb a={a} className="h-full w-full" />
          {i === shown.length - 1 && extra > 0 && (
            <span className="absolute inset-0 grid place-items-center bg-black/50 text-xl font-bold text-white">+{extra}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function MediaThumb({ a, className, style }: { a: ChatAttachmentDTO; className?: string; style?: React.CSSProperties }) {
  const still = a.kind === 'image' ? a.url : a.posterUrl;
  return (
    <span className={cn('relative block overflow-hidden bg-black/10', className)} style={style}>
      {still ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed private-bucket URL
        <img src={still} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
      ) : (
        <video src={a.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
      )}
      {a.kind === 'video' && (
        <>
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white">
              <Play width={20} height={20} />
            </span>
          </span>
          {a.durationSec !== null && (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white">
              {formatDuration(a.durationSec)}
            </span>
          )}
        </>
      )}
    </span>
  );
}

/** Text with @mentions highlighted (stronger when it's you) and links tappable. */
function renderText(m: ClientMessage, memberNames: Map<string, string>, meId: string): ReactNode {
  const tokens = new Map<string, boolean>(); // "@Name" → is it me
  for (const id of m.mentionIds) {
    const n = memberNames.get(id);
    if (n) tokens.set(`@${n}`, id === meId);
  }
  if (m.mentionsAll) tokens.set('@all', true);
  const text = m.text ?? '';
  const parts = tokens.size
    ? text.split(new RegExp(`(${[...tokens.keys()].sort((a, b) => b.length - a.length).map(escapeRe).join('|')})`, 'gi'))
    : [text];
  return parts.map((part, i) => {
    const hit = [...tokens.entries()].find(([t]) => t.toLowerCase() === part.toLowerCase());
    if (hit) {
      return (
        <span key={i} className={cn('rounded px-0.5 font-semibold', hit[1] ? 'bg-unread/25' : 'bg-black/10 dark:bg-white/15')}>
          {part}
        </span>
      );
    }
    return (
      <Fragment key={i}>
        {linkify(part).map((p, j) =>
          p.href ? (
            <a key={j} href={p.href} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2">
              {p.text}
            </a>
          ) : (
            <Fragment key={j}>{p.text}</Fragment>
          ),
        )}
      </Fragment>
    );
  });
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Long-press on touch (and right-click on desktop) opens the actions sheet. A
 * long-press swallows the click that follows, so it doesn't also open a photo
 * or follow a link.
 */
function useLongPress(onLong: () => void) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        haptics.press();
        onLong();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (origin.current && Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 10) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      if (!fired.current) onLong();
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
      }
    },
  };
}
