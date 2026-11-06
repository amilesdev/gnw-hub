'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '@/lib/api-client';
import type { ChatGifPageDTO, ChatGifResultDTO } from '@/lib/chat/types';
import { cn } from '@/lib/utils';
import { Search, X } from '@/components/shared/Icons';
import { useBackClose } from './useBackClose';
import { useVisualViewportBox } from './viewport';

type Tab = 'gifs' | 'stickers';

/** Wait this long after the last keystroke before searching (each search is one of GIPHY's 100 calls an hour). */
const SEARCH_DEBOUNCE_MS = 450;

/**
 * GIF + sticker picker (GIPHY): trending until you search, two columns, more
 * load as you scroll. A bottom sheet like the emoji picker, riding above the
 * keyboard while searching. Results come through our server (/api/chat/gifs).
 * Picking sends it straight away, as its own message.
 */
export function GifPicker({ onPick, onClose }: { onPick: (gif: ChatGifResultDTO) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('gifs');
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatGifResultDTO[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const request = useRef(0);
  const box = useVisualViewportBox();

  useBackClose(onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(input.trim()), input.trim() ? SEARCH_DEBOUNCE_MS : 0);
    return () => window.clearTimeout(t);
  }, [input]);

  const load = useCallback(
    async (offset: number) => {
      const id = ++request.current;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ type: tab, offset: String(offset) });
        if (query) params.set('q', query);
        const page = await apiFetch<ChatGifPageDTO>(`/api/chat/gifs?${params}`);
        if (id !== request.current) return; // a newer search or tab won
        setResults((prev) => {
          if (offset === 0) return page.results;
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...page.results.filter((r) => !seen.has(r.id))];
        });
        setHasMore(page.hasMore);
      } catch (e) {
        if (id === request.current) setError(e instanceof Error ? e.message : 'Couldn’t load GIFs.');
      } finally {
        if (id === request.current) setLoading(false);
      }
    },
    [tab, query],
  );

  // A new tab or search starts over at the top.
  useEffect(() => {
    setResults([]);
    setHasMore(false);
    if (body.current) body.current.scrollTop = 0;
    void load(0);
  }, [load]);

  function onScroll() {
    const el = body.current;
    if (!el || loading || !hasMore || error) return;
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 400) void load(results.length);
  }

  const pick = (g: ChatGifResultDTO) => {
    onPick(g);
    onClose();
  };

  if (typeof document === 'undefined') return null;
  const lift = box ? Math.max(0, window.innerHeight - (box.top + box.height)) : 0;
  // Two columns, each item placed in the shorter one, so the grid stays balanced.
  const columns: ChatGifResultDTO[][] = [[], []];
  const heights = [0, 0];
  for (const g of results) {
    const c = heights[0] <= heights[1] ? 0 : 1;
    columns[c].push(g);
    heights[c] += g.previewHeight / g.previewWidth;
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 animate-fade-in bg-scrim" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Send a GIF or sticker"
        className="relative z-10 flex w-full max-w-[430px] animate-sheet-up flex-col overflow-hidden rounded-t-3xl bg-surface shadow-card-lg"
        style={{ marginBottom: lift, height: box ? Math.min(box.height - 24, 560) : 'min(75vh, 620px)' }}
      >
        <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-3">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-surface-2 px-3.5 py-2">
            <Search width={17} height={17} className="shrink-0 text-ink-faint" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tab === 'gifs' ? 'Search GIFs' : 'Search stickers'}
              aria-label={tab === 'gifs' ? 'Search GIFs' : 'Search stickers'}
              enterKeyHint="search"
              maxLength={50}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setQuery(input.trim());
              }}
              className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-faint"
            />
            {input && (
              <button type="button" onClick={() => setInput('')} aria-label="Clear search" className="text-ink-faint">
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

        <div className="flex shrink-0 gap-1 px-3 pb-2" role="tablist">
          {(['gifs', 'stickers'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 rounded-full py-1.5 text-sm font-semibold transition',
                tab === t ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-ink-soft',
              )}
            >
              {t === 'gifs' ? 'GIFs' : 'Stickers'}
            </button>
          ))}
        </div>

        <div ref={body} onScroll={onScroll} className="relative flex-1 overflow-y-auto overscroll-contain px-2">
          {results.length > 0 && (
            <div className="flex items-start gap-1.5">
              {columns.map((col, i) => (
                <div key={i} className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {col.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      // Keep focus (and the keyboard) in the search box, as in the emoji picker.
                      onPointerDown={(e) => e.preventDefault()}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(g)}
                      aria-label={g.title || (tab === 'gifs' ? 'GIF' : 'Sticker')}
                      className={cn('block w-full overflow-hidden rounded-xl transition active:scale-95', tab === 'gifs' && 'bg-surface-2')}
                      style={{ aspectRatio: `${g.previewWidth} / ${g.previewHeight}` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- GIPHY media */}
                      <img src={g.previewUrl} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
          {error ? (
            <div className="py-10 text-center text-sm text-ink-faint">
              <p>{error}</p>
              <button type="button" onClick={() => void load(results.length)} className="mt-2 font-semibold text-accent-ink">
                Try again
              </button>
            </div>
          ) : loading ? (
            <p className="py-8 text-center text-sm text-ink-faint">Loading…</p>
          ) : results.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-faint">Nothing found. Try another word.</p>
          ) : null}
        </div>

        {/* GIPHY's terms: their attribution mark wherever their search is used. */}
        <div className="flex shrink-0 justify-center border-t border-line py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {/* eslint-disable-next-line @next/next/no-img-element -- static attribution mark */}
          <img src="/giphy/powered-by-giphy.png" alt="Powered by GIPHY" width={113} height={24} className="h-6 w-auto rounded" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
