'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { QUICK_REACTIONS, withinEditWindow } from '@/lib/chat/types';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Copy, Pencil, Pin, Plus, Reply, Trash } from '@/components/shared/Icons';
import { BubbleBody, type ClientMessage } from './ChatMessages';

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const GAP = 10;
const EDGE = 12;
const LIFT_SCALE = 1.03;

type Layout = {
  bubbleTop: number;
  /** Set when the message is too tall to fit with the bar + menu: show its top part. */
  bubbleMax: number | null;
  barTop: number;
  barLeft: number;
  barWidth: number;
  menuTop: number;
  menuLeft: number;
  menuWidth: number;
};

/**
 * Long-press menu, the way messaging apps do it: the chat blurs, the message
 * lifts out of the list (slightly enlarged) with a reaction bar above it and
 * the actions below — Reply · Copy · Edit · Pin · Delete, each only when
 * allowed (the server enforces the same rules). The "+" opens the full picker.
 *
 * The bubble shown is a copy of the original, placed on the original's spot
 * and moved only as far as it takes to fit the bar and menu on screen.
 */
export function MessageMenu({
  message: m,
  bubble,
  meId,
  memberNames,
  canModerate,
  readOnly,
  onClose,
  onReact,
  onMoreReactions,
  onReply,
  onEdit,
  onPin,
  onDelete,
  onCopied,
}: {
  message: ClientMessage;
  /** The bubble element in the list (where the copy starts from). */
  bubble: HTMLElement;
  meId: string;
  memberNames: Map<string, string>;
  canModerate: boolean;
  /** Archived chat: look, copy, nothing else. */
  readOnly: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onMoreReactions: () => void;
  onReply: () => void;
  onEdit: () => void;
  onPin: (pinned: boolean) => void;
  onDelete: () => void;
  onCopied: () => void;
}) {
  const [anchor] = useState(() => bubble.getBoundingClientRect());
  const [radius] = useState(() => {
    const s = getComputedStyle(bubble);
    return `${s.borderTopLeftRadius} ${s.borderTopRightRadius} ${s.borderBottomRightRadius} ${s.borderBottomLeftRadius}`;
  });
  const [layout, setLayout] = useState<Layout | null>(null);
  const [shown, setShown] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  // The finger that long-pressed is still down when this opens; its lift must
  // not count as a tap on whatever ends up under it. Armed by the next touch.
  const armed = useRef(false);

  const mine = m.author?.id === meId;
  const canEdit = mine && !readOnly && withinEditWindow(m.createdAt) && !m.deleted;
  const canDelete = !readOnly && (mine || canModerate);
  const myEmojis = new Set(m.reactions.filter((r) => r.mine).map((r) => r.emoji));

  // Measure the bar + menu, then place everything inside the visible screen.
  useLayoutEffect(() => {
    const vv = window.visualViewport;
    const top = (vv?.offsetTop ?? 0) + EDGE;
    const bottom = (vv ? vv.offsetTop + vv.height : window.innerHeight) - EDGE;
    const vw = document.documentElement.clientWidth;
    const barH = bar.current?.offsetHeight ?? 0;
    const menuH = menu.current?.offsetHeight ?? 0;
    const h = anchor.height;

    let bubbleTop: number;
    let bubbleMax: number | null = null;
    if (barH + menuH + h + 2 * GAP > bottom - top) {
      bubbleMax = Math.max(64, bottom - top - barH - menuH - 2 * GAP);
      bubbleTop = top + barH + GAP;
    } else {
      bubbleTop = Math.min(Math.max(anchor.top, top + barH + GAP), bottom - menuH - GAP - h);
    }
    const shownH = bubbleMax ?? h;

    const barWidth = Math.min(vw - 16, 384);
    const menuWidth = Math.min(vw - 16, 248);
    const side = (width: number) =>
      clamp(mine ? anchor.right - width : anchor.left, 8, vw - 8 - width);

    setLayout({
      bubbleTop,
      bubbleMax,
      barTop: bubbleTop - GAP - barH,
      barLeft: side(barWidth),
      barWidth,
      menuTop: bubbleTop + shownH + GAP,
      menuLeft: side(menuWidth),
      menuWidth,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measured once on open
  }, []);

  // The original stays in the list (keeping its space) but hidden while its copy
  // is lifted; it comes back when the menu is gone or the delete confirm shows.
  useEffect(() => {
    if (confirming) return;
    bubble.style.visibility = 'hidden';
    return () => {
      bubble.style.visibility = '';
    };
  }, [bubble, confirming]);

  // Then animate in (next frame, so the start position is painted first).
  useEffect(() => {
    if (!layout) return;
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [layout]);

  function close() {
    if (leaving.current) return;
    leaving.current = true;
    setShown(false);
    window.setTimeout(onClose, 200);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close is stable in effect
  }, []);

  /** Run an action (only on a deliberate tap), then fold the menu away. */
  const act = (fn: () => void, keepOpen = false) => () => {
    if (!armed.current) return;
    fn();
    if (!keepOpen) close();
  };

  if (typeof document === 'undefined') return null;

  if (confirming) {
    return (
      <ConfirmDialog
        open
        title="Delete message?"
        message={
          mine
            ? 'It’s replaced with “message deleted” for everyone, along with any photos, videos or files.'
            : `You’re deleting ${m.author?.name.split(' ')[0] ?? 'this person'}’s message as a moderator. It’s replaced with “message deleted” for everyone.`
        }
        confirmLabel="Delete"
        onClose={onClose}
        onConfirm={() => {
          onDelete();
          onClose();
        }}
      />
    );
  }

  const measuring = !layout;
  const fade = { opacity: shown ? 1 : 0, transition: `opacity 0.2s ${EASE}, transform 0.26s ${EASE}` };
  const origin = mine ? 'right' : 'left';

  return createPortal(
    <div
      className="fixed inset-0 z-[55]"
      role="dialog"
      aria-modal="true"
      aria-label="Message actions"
      onPointerDown={() => {
        armed.current = true;
      }}
      onKeyDown={() => {
        armed.current = true;
      }}
    >
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-md dark:bg-black/45"
        style={{ opacity: shown ? 1 : 0, transition: `opacity 0.22s ${EASE}` }}
        onClick={act(() => {})}
        aria-hidden
      />

      {/* The lifted bubble */}
      {layout && (
        <div
          className="pointer-events-none absolute overflow-hidden"
          style={{
            left: anchor.left,
            width: anchor.width,
            top: layout.bubbleTop,
            maxHeight: layout.bubbleMax ?? undefined,
            borderRadius: radius,
            transformOrigin: `${origin} center`,
            transform: shown ? `scale(${LIFT_SCALE})` : `translateY(${anchor.top - layout.bubbleTop}px)`,
            transition: `transform 0.28s ${EASE}`,
            boxShadow: shown ? '0 12px 32px -12px rgb(0 0 0 / 0.35)' : 'none',
          }}
        >
          <BubbleBody
            message={m}
            mine={mine}
            last={false}
            meId={meId}
            memberNames={memberNames}
            onJumpTo={() => {}}
            onOpenMedia={() => {}}
            style={{ borderRadius: radius }}
          />
          {layout.bubbleMax && (
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/25 to-transparent" />
          )}
        </div>
      )}

      {/* Reaction bar */}
      {!readOnly && (
        <div
          ref={bar}
          className={cn('absolute flex items-center gap-0.5 rounded-full border border-line bg-surface/95 p-1.5 shadow-card-lg backdrop-blur', measuring && 'invisible')}
          style={{
            top: layout?.barTop ?? 0,
            left: layout?.barLeft ?? 0,
            width: layout?.barWidth,
            transformOrigin: `${origin} bottom`,
            transform: shown ? 'scale(1)' : 'scale(0.9)',
            ...fade,
          }}
        >
          {QUICK_REACTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={act(() => onReact(e))}
              aria-label={`React ${e}`}
              aria-pressed={myEmojis.has(e)}
              className={cn(
                'grid h-11 min-w-0 flex-1 place-items-center rounded-full text-[1.65rem] leading-none transition active:scale-90',
                myEmojis.has(e) && 'bg-accent/20',
              )}
            >
              {e}
            </button>
          ))}
          <button
            type="button"
            onClick={act(onMoreReactions)}
            aria-label="More reactions"
            className="grid h-11 min-w-0 flex-1 place-items-center rounded-full bg-surface-2 text-ink-soft"
          >
            <Plus width={20} height={20} />
          </button>
        </div>
      )}

      {/* Actions */}
      <div
        ref={menu}
        className={cn('absolute overflow-hidden rounded-2xl border border-line bg-surface/95 shadow-card-lg backdrop-blur', measuring && 'invisible')}
        style={{
          top: layout?.menuTop ?? 0,
          left: layout?.menuLeft ?? 0,
          width: layout?.menuWidth ?? 248,
          transformOrigin: `${origin} top`,
          transform: shown ? 'scale(1)' : 'scale(0.9)',
          ...fade,
        }}
      >
        {m.reactions.length > 0 && (
          <div className="no-scrollbar max-h-28 space-y-1 overflow-y-auto border-b border-line px-4 py-2.5">
            {m.reactions.map((r) => (
              <p key={r.emoji} className="flex items-baseline gap-2 text-sm">
                <span className="text-base">{r.emoji}</span>
                <span className="min-w-0 truncate text-ink-soft">{r.names.join(', ')}</span>
              </p>
            ))}
          </div>
        )}
        {!readOnly && <Item icon={<Reply width={20} height={20} />} label="Reply" onClick={act(onReply)} />}
        {m.text && (
          <Item
            icon={<Copy width={20} height={20} />}
            label="Copy"
            onClick={act(() => {
              void navigator.clipboard?.writeText(m.text ?? '').then(onCopied, () => {});
            })}
          />
        )}
        {canEdit && <Item icon={<Pencil width={19} height={19} />} label="Edit" onClick={act(onEdit)} />}
        {!readOnly && (
          <Item icon={<Pin width={20} height={20} />} label={m.pinnedAt ? 'Unpin' : 'Pin'} onClick={act(() => onPin(!m.pinnedAt))} />
        )}
        {canDelete && (
          <div className="border-t border-line">
            <Item icon={<Trash width={20} height={20} />} label="Delete" danger onClick={act(() => setConfirming(true), true)} />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Item({ icon, label, danger, onClick }: { icon: ReactNode; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('row-press flex w-full items-center gap-3.5 px-4 py-3 text-left text-[16px]', danger ? 'text-bad' : 'text-ink')}
    >
      <span className={cn('grid w-5 place-items-center', danger ? 'text-bad' : 'text-ink-soft')}>{icon}</span>
      {label}
    </button>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
