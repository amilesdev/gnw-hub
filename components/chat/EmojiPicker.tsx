'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Clock, Search, X } from '@/components/shared/Icons';
import { useBackClose } from './useBackClose';
import { useVisualViewportBox } from './viewport';

/** `n` = the Unicode name (its label); `s` = what search matches (name + everyday words). */
type Entry = { e: string; n: string; s: string };
type Group = { label: string; icon: string; entries: Entry[] };

const RECENT_KEY = 'gnw-chat-recent-emoji';
const RECENT_MAX = 24;

// The words people actually search with, which the Unicode names miss
// (🙏 is "folded hands"; nobody types that).
const ALIASES: Record<string, string> = {
  '🙏': 'pray prayer praying please thanks thank you amen bless',
  '🙌': 'praise hallelujah amen worship celebrate yay',
  '🛐': 'worship pray',
  '✝️': 'jesus christ faith church',
  '⛪': 'worship',
  '🕊️': 'peace holy spirit',
  '📖': 'bible scripture word',
  '❤️': 'love',
  '😍': 'love',
  '🥰': 'love',
  '🫶': 'love',
  '😂': 'lol laugh haha funny lmao',
  '🤣': 'lol laugh haha funny lmao rofl',
  '🔥': 'lit hot',
  '👍': 'yes ok okay like agree good',
  '👎': 'no dislike bad',
  '👏': 'applause bravo',
  '😮': 'wow shock surprised omg',
  '😢': 'sad tears',
  '😭': 'sad sob',
  '🎉': 'party celebrate congrats yay',
  '🥳': 'celebrate birthday',
  '💯': 'perfect facts',
  '🎶': 'song',
  '🎵': 'song',
  '🎤': 'sing vocals mic',
  '🤝': 'deal agree',
  '💪': 'strong strength',
  '👀': 'look see',
  '✅': 'done yes',
  '❌': 'no wrong',
  '🤔': 'hmm',
  '😴': 'tired',
  '🥹': 'grateful touched',
};

/** Remember a reaction for the picker's "Recently used" row (per device, best-effort). */
export function rememberEmoji(emoji: string) {
  try {
    const list = [emoji, ...readRecent().filter((x) => x !== emoji)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* private mode / storage blocked */
  }
}

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

// Loaded on first open and kept: ~1,900 emoji with names (for search).
let cache: Promise<Group[]> | null = null;
function loadGroups(): Promise<Group[]> {
  cache ??= import('./emoji-data').then(({ EMOJI_DATA }) =>
    EMOJI_DATA.map((g) => ({
      label: g.label,
      icon: g.icon,
      entries: g.list.split('|').map((s) => {
        const i = s.indexOf(' ');
        const e = s.slice(0, i);
        const n = s.slice(i + 1);
        return { e, n, s: ALIASES[e] ? `${n} ${ALIASES[e]}` : n };
      }),
    })),
  );
  return cache;
}

/**
 * The full reaction picker: every emoji, by category (tabs jump to a section),
 * with "Recently used" first and search by name. A bottom sheet that rides above
 * the keyboard while searching.
 */
export function EmojiPicker({
  selected,
  onPick,
  onClose,
}: {
  /** Emoji the viewer already reacted with (tapping one again removes it). */
  selected: Set<string>;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [recent] = useState(readRecent);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  const box = useVisualViewportBox();

  useBackClose(onClose);

  useEffect(() => {
    let live = true;
    void loadGroups().then((g) => live && setGroups(g));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      live = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const sections = useMemo(() => {
    if (!groups) return [];
    const recentGroup: Group[] = recent.length
      ? [{ label: 'Recently used', icon: '', entries: recent.map((e) => ({ e, n: '', s: '' })) }]
      : [];
    return [...recentGroup, ...groups];
  }, [groups, recent]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !groups) return null;
    const all = groups.flatMap((g) => g.entries);
    // Names that start with the query (or have a word that does) first, then any match.
    const starts = all.filter((x) => x.s.startsWith(q) || x.s.includes(` ${q}`));
    const seen = new Set(starts);
    return [...starts, ...all.filter((x) => !seen.has(x) && x.s.includes(q))].slice(0, 160);
  }, [groups, query]);

  function jump(i: number) {
    setQuery('');
    setActive(i);
    window.requestAnimationFrame(() => {
      const el = body.current?.querySelector<HTMLElement>(`[data-section="${i}"]`);
      if (el && body.current) body.current.scrollTop = el.offsetTop - 4;
    });
  }

  function onScroll() {
    const el = body.current;
    if (!el || results) return;
    const nodes = [...el.querySelectorAll<HTMLElement>('[data-section]')];
    let current = 0;
    for (const n of nodes) if (n.offsetTop - 8 <= el.scrollTop) current = Number(n.dataset.section);
    if (current !== active) setActive(current);
  }

  const pick = (e: string) => {
    onPick(e);
    onClose();
  };

  if (typeof document === 'undefined') return null;
  const lift = box ? Math.max(0, window.innerHeight - (box.top + box.height)) : 0;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 animate-fade-in bg-scrim" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pick a reaction"
        className="relative z-10 flex w-full max-w-[430px] animate-sheet-up flex-col overflow-hidden rounded-t-3xl bg-surface shadow-card-lg"
        style={{ marginBottom: lift, height: box ? Math.min(box.height - 24, 440) : 'min(68vh, 560px)' }}
      >
        <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-3">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-surface-2 px-3.5 py-2">
            <Search width={17} height={17} className="shrink-0 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search emoji"
              aria-label="Search emoji"
              enterKeyHint="search"
              className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-faint"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-ink-faint">
                <X width={15} height={15} />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="row-press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft"
          >
            <X width={17} height={17} />
          </button>
        </div>

        {!results && sections.length > 0 && (
          <div className="no-scrollbar flex shrink-0 gap-0.5 overflow-x-auto border-b border-line px-2 pb-1.5">
            {sections.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => jump(i)}
                aria-label={s.label}
                className={cn(
                  'grid h-9 min-w-[2.25rem] flex-1 place-items-center rounded-xl text-xl transition',
                  active === i ? 'bg-accent/15' : 'opacity-60',
                )}
              >
                {s.icon || <Clock width={18} height={18} className="text-ink-soft" />}
              </button>
            ))}
          </div>
        )}

        <div ref={body} onScroll={onScroll} className="relative flex-1 overflow-y-auto overscroll-contain px-2 pb-6">
          {!groups ? (
            <p className="py-10 text-center text-sm text-ink-faint">Loading…</p>
          ) : results ? (
            results.length ? (
              <Grid entries={results} selected={selected} onPick={pick} />
            ) : (
              <p className="py-10 text-center text-sm text-ink-faint">No emoji found.</p>
            )
          ) : (
            sections.map((s, i) => (
              <section key={s.label} data-section={i}>
                <p className="sticky top-0 z-[1] bg-surface/95 px-1.5 pb-1 pt-2.5 text-xs font-semibold text-ink-faint backdrop-blur">
                  {s.label}
                </p>
                <Grid entries={s.entries} selected={selected} onPick={pick} />
              </section>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Grid({ entries, selected, onPick }: { entries: Entry[]; selected: Set<string>; onPick: (e: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-0.5">
      {entries.map((x) => (
        <button
          key={x.e}
          type="button"
          // Keep focus (and the keyboard) in the search box: dropping it mid-tap
          // resizes the sheet under the finger and the tap lands on nothing.
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(x.e)}
          aria-label={x.n || x.e}
          aria-pressed={selected.has(x.e)}
          className={cn(
            'grid aspect-square place-items-center rounded-xl text-[1.7rem] leading-none transition active:scale-90',
            selected.has(x.e) && 'bg-accent/20',
          )}
        >
          {x.e}
        </button>
      ))}
    </div>
  );
}
