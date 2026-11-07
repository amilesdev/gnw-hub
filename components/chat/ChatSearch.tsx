'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { chatTitle, type ChatSearchHitDTO, type ChatSearchPageDTO } from '@/lib/chat/types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { ChevronLeft, Search, X } from '@/components/shared/Icons';
import { ChatAvatar } from './ChatAvatar';
import { formatSearchStamp } from './format';
import { useVisualViewportBox } from './viewport';

const DEBOUNCE_MS = 250;

type Results = { q: string; hits: ChatSearchHitDTO[]; page: ChatSearchPageDTO };

/** Worth sending: two characters, or one that isn't a letter/digit (an emoji). */
function searchable(q: string): boolean {
  return q.length >= 2 || /[^\p{L}\p{N}\s]/u.test(q);
}

/**
 * Message search, full screen over whatever opened it. With a `chat` it
 * searches that chat (and its topics) by default, with a toggle for all your
 * chats; without one (the chat list) it searches everything.
 *
 * A hit in the thread that's open underneath jumps there in place
 * (`onJumpHere`); any other hit opens its chat at that message (`?m=`). The
 * screen stays mounted while hidden, so coming back finds the same results.
 */
export function ChatSearch({
  base,
  open,
  chat,
  hereId,
  onJumpHere,
  onClose,
}: {
  base: '/home' | '/dashboard';
  open: boolean;
  /** The chat to search by default: a root chat (its topics come with it). */
  chat: { id: string; name: string } | null;
  /** The thread that's open under this screen, if any. */
  hereId?: string;
  onJumpHere?: (messageId: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const box = useVisualViewportBox();
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(!chat);
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const q = query.trim();
  const scopeChat = all ? null : chat;

  useLayoutEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const url = (extra = '') =>
    `/api/chat/search?q=${encodeURIComponent(q)}${scopeChat ? `&chat=${encodeURIComponent(scopeChat.id)}` : ''}${extra}`;

  useEffect(() => {
    if (!searchable(q)) {
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const page = await apiFetch<ChatSearchPageDTO>(url(), { signal: ctrl.signal });
        setResults({ q, hits: page.hits, page });
        setError(null);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error && !/Request failed/.test(e.message) ? e.message : 'Couldn’t search right now.');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- url() is derived from q + scope
  }, [q, scopeChat?.id]);

  async function loadMore() {
    if (!results || loadingMore) return;
    const last = results.hits.at(-1);
    if (!last) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<ChatSearchPageDTO>(
        url(`&before=${encodeURIComponent(last.id)}&mode=${results.page.mode}`),
      );
      setResults((r) => (r && r.q === q ? { q, hits: [...r.hits, ...page.hits], page } : r));
    } catch {
      /* the button stays; try again */
    } finally {
      setLoadingMore(false);
    }
  }

  function openHit(hit: ChatSearchHitDTO) {
    input.current?.blur();
    if (hit.chatId === hereId && onJumpHere) {
      onClose();
      onJumpHere(hit.id);
    } else {
      router.push(`${base}/chat/${hit.chatId}?m=${encodeURIComponent(hit.id)}`);
    }
  }

  // While a new search runs, the last results stay up (dimmed) instead of flashing away.
  const shown = results;
  const stale = loading || (!!results && results.q !== q);

  return (
    <div
      className={cn('fixed inset-x-0 z-50 flex flex-col bg-app', !open && 'hidden')}
      style={box ? { top: box.top, height: box.height } : { top: 0, bottom: 0 }}
      role="dialog"
      aria-label="Search messages"
    >
      <header
        className="shrink-0 border-b border-line bg-app"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        <form
          role="search"
          className="flex items-center gap-2 px-3 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            input.current?.blur(); // drop the keyboard so the results show
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="row-press grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink-soft"
            aria-label="Close search"
          >
            <ChevronLeft width={22} height={22} />
          </button>
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-surface-2 px-3">
            <Search width={18} height={18} className="shrink-0 text-ink-faint" />
            <input
              ref={input}
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={scopeChat ? `Search ${scopeChat.name}` : 'Search all chats'}
              aria-label="Search messages"
              maxLength={100}
              className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-faint [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  input.current?.focus();
                }}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-faint/30 text-ink-soft"
                aria-label="Clear search"
              >
                <X width={13} height={13} />
              </button>
            )}
          </label>
        </form>

        {chat && (
          <div className="flex gap-2 px-4 pb-2.5" role="radiogroup" aria-label="Where to search">
            <ScopeChip on={!all} onClick={() => setAll(false)}>
              {chat.name}
            </ScopeChip>
            <ScopeChip on={all} onClick={() => setAll(true)}>
              All chats
            </ScopeChip>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {!searchable(q) ? (
          <p className="px-8 pt-10 text-center text-sm text-ink-faint">
            {scopeChat ? `Search messages in ${scopeChat.name}.` : 'Search messages in all your chats.'}
          </p>
        ) : error && !shown ? (
          <p className="px-8 pt-10 text-center text-sm text-bad-ink">{error}</p>
        ) : !shown ? (
          <p className="px-8 pt-10 text-center text-sm text-ink-faint">Searching…</p>
        ) : shown.hits.length === 0 ? (
          <p className="px-8 pt-10 text-center text-sm text-ink-faint">
            {stale ? 'Searching…' : `No messages match “${q}”.`}
          </p>
        ) : (
          <>
            <ul className={cn('divide-y divide-line transition-opacity', stale && 'opacity-60')}>
              {shown.hits.map((h) => (
                <li key={h.id}>
                  <HitRow hit={h} showChat={!scopeChat} onOpen={() => openHit(h)} />
                </li>
              ))}
            </ul>
            {shown.page.hasMore && !stale && (
              <div className="px-4 pt-3">
                <button type="button" className="btn-ghost w-full py-3" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Show more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ScopeChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'max-w-[60%] truncate rounded-full border px-3 py-1 text-sm font-semibold transition-colors',
        on ? 'border-accent bg-accent text-accent-fg' : 'border-line text-ink-soft',
      )}
    >
      {children}
    </button>
  );
}

function HitRow({ hit, showChat, onOpen }: { hit: ChatSearchHitDTO; showChat: boolean; onOpen: () => void }) {
  const former = !hit.author;
  const name = hit.author?.name ?? hit.importedAuthorName ?? 'Former member';
  // In one chat, only a topic hit needs saying where it is; across chats, every hit does.
  const where = showChat ? chatTitle(hit.chatName, hit.parentName) : hit.parentName ? `# ${hit.chatName}` : null;
  return (
    <button type="button" onClick={onOpen} className="row-press flex w-full items-start gap-3 px-4 py-3 text-left">
      <ChatAvatar name={name} image={hit.author?.image ?? hit.importedAuthorAvatar} size={36} former={former} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn('min-w-0 flex-1 truncate text-sm font-semibold', former && 'text-ink-faint')}>
            {name}
            {where && <span className="font-normal text-ink-faint"> · {where}</span>}
          </span>
          <span className="shrink-0 text-xs text-ink-faint" suppressHydrationWarning>
            {formatSearchStamp(hit.createdAt)}
          </span>
        </span>
        <span className="mt-0.5 line-clamp-3 whitespace-pre-line break-words text-sm text-ink-soft [overflow-wrap:anywhere]">
          {hit.snippet.map((p, i) =>
            p.hit ? (
              <mark key={i} className="rounded bg-unread/25 px-0.5 font-semibold text-ink">
                {p.text}
              </mark>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )}
        </span>
      </span>
    </button>
  );
}
