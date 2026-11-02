'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { SongSuggestionDTO } from '@/lib/serialize';
import { MusicPlus, Pencil, Trash, Check, X, Book, ChevronLeft } from './Icons';
import { TextField } from './Field';
import { EmptyState } from './EmptyState';
import { SegmentedControl } from './SegmentedControl';
import { ConfirmDialog } from './ConfirmDialog';
import { Modal } from './Modal';
import { apiFetch } from '@/lib/api-client';
import { parseYouTubeId } from '@/lib/youtube';

/** Day-level age: "Today", "3 days ago", "1 week ago", "2 months ago", "1 year ago". */
function formatAge(iso: string): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);
  const ago = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;
  if (days <= 0) return 'Today';
  if (days < 7) return ago(days, 'day');
  if (days < 30) return ago(Math.floor(days / 7), 'week');
  if (days < 365) return ago(Math.min(11, Math.floor(days / 30)), 'month');
  return ago(Math.floor(days / 365), 'year');
}

type Preview = {
  videoId: string;
  url: string;
  thumbnailUrl: string;
  found: boolean;
  songTitle: string;
  artist: string | null;
  duplicate: string | null;
};

// All = everyone's live suggestions (passed ones drop out); Mine = your own,
// any status, with passed ones tagged "Dismissed".
type Tab = 'all' | 'mine';

/**
 * Song suggestions: paste a YouTube link, the title/artist fill themselves in
 * from the video (editable if the guess is off), submit. Below, the whole
 * team's suggestions. Leaders add one to the library or pass on it.
 */
export function SuggestionsScreen({
  canManage,
  meId,
  initialSuggestions,
  backHref,
}: {
  canManage: boolean;
  meId: string;
  initialSuggestions: SongSuggestionDTO[];
  /** The Song Library this screen opens from. */
  backHref: string;
}) {
  const [items, setItems] = useState(initialSuggestions);
  const [tab, setTab] = useState<Tab>('all');

  // Composer
  const [link, setLink] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);

  // Leader actions
  const [adding, setAdding] = useState<SongSuggestionDTO | null>(null);
  const [removing, setRemoving] = useState<SongSuggestionDTO | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Look the link up as soon as it parses — pasting is the whole interaction.
  useEffect(() => {
    setPreview(null);
    setPreviewError(null);
    setEditing(false);
    setError(null);
    const trimmed = link.trim();
    if (!trimmed) return;
    if (!parseYouTubeId(trimmed)) {
      setPreviewError('That doesn’t look like a YouTube link.');
      return;
    }
    let cancelled = false;
    setLooking(true);
    const t = window.setTimeout(async () => {
      try {
        const p = await apiFetch<Preview>(`/api/suggestions/preview?url=${encodeURIComponent(trimmed)}`);
        if (cancelled) return;
        setPreview(p);
        setTitle(p.songTitle);
        setArtist(p.artist ?? '');
        // Lookup failed → no guess to show, so go straight to the fields.
        if (!p.found) setEditing(true);
      } catch (err) {
        if (!cancelled) setPreviewError(err instanceof Error ? err.message : 'Could not look up that link.');
      } finally {
        if (!cancelled) setLooking(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      setLooking(false);
    };
  }, [link]);

  async function submit() {
    if (!preview) return;
    if (!title.trim()) {
      setEditing(true);
      return setError('Add the song title.');
    }
    setBusy(true);
    setError(null);
    try {
      const { suggestion } = await apiFetch<{ suggestion: SongSuggestionDTO }>('/api/suggestions', {
        method: 'POST',
        body: JSON.stringify({ url: preview.url, songTitle: title.trim(), artist: artist.trim() }),
      });
      setItems((prev) => [suggestion, ...prev]);
      setLink('');
      setJustSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that suggestion.');
    } finally {
      setBusy(false);
    }
  }

  function replace(s: SongSuggestionDTO) {
    setItems((prev) => prev.map((x) => (x.id === s.id ? s : x)));
  }

  async function setStatus(s: SongSuggestionDTO, status: 'open' | 'dismissed') {
    const prev = items;
    replace({ ...s, status });
    try {
      const { suggestion } = await apiFetch<{ suggestion: SongSuggestionDTO }>(`/api/suggestions/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      replace(suggestion);
    } catch {
      setItems(prev);
    }
  }

  async function remove() {
    if (!removing) return;
    setActionBusy(true);
    try {
      await apiFetch(`/api/suggestions/${removing.id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((x) => x.id !== removing.id));
      setRemoving(null);
    } finally {
      setActionBusy(false);
    }
  }

  const visible = useMemo(
    () =>
      items.filter((s) =>
        tab === 'all' ? s.status !== 'dismissed' : s.suggestedById === meId,
      ),
    [items, tab, meId],
  );

  const tabs: { value: Tab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'mine', label: 'My Suggestions' },
  ];

  return (
    <div className="space-y-5 pt-2">
      <header>
        <Link
          href={backHref}
          className="row-press mb-2 -ml-1 grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-soft"
          aria-label="Back to Library"
        >
          <ChevronLeft width={18} height={18} />
        </Link>
        <h1 className="page-title">Suggestions</h1>
        <p className="mt-2 text-sm text-ink-soft">Submit your song suggestions here!</p>
      </header>

      {/* Composer */}
      <section className="card space-y-4 p-4">
        <div className="relative">
          <input
            className="field pr-11"
            type="url"
            inputMode="url"
            enterKeyHint="done"
            autoComplete="off"
            placeholder="Paste a YouTube link"
            aria-label="YouTube link"
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setJustSent(false);
            }}
          />
          {link && (
            <button
              type="button"
              aria-label="Clear link"
              onClick={() => setLink('')}
              className="row-press absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ink-faint"
            >
              <X width={16} height={16} />
            </button>
          )}
        </div>

        {looking && <p className="text-sm text-ink-faint">Looking it up…</p>}
        {previewError && <p role="alert" className="text-sm font-semibold text-bad">{previewError}</p>}

        {preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube still */}
              <img
                src={preview.thumbnailUrl}
                alt=""
                className="aspect-video w-28 shrink-0 rounded-xl bg-surface-2 object-cover"
              />
              <div className="min-w-0 flex-1">
                {preview.found ? (
                  <>
                    <p className="truncate font-semibold">{title || 'Untitled'}</p>
                    <p className="truncate text-sm text-ink-soft">{artist || 'Unknown artist'}</p>
                  </>
                ) : (
                  <p className="text-sm text-ink-soft">Couldn’t read the video details — add them below.</p>
                )}
                {preview.found && !editing && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-accent dark:text-accent-on"
                  >
                    <Pencil width={13} height={13} /> Not quite right? Edit
                  </button>
                )}
              </div>
            </div>

            {editing && (
              <div className="space-y-3">
                <TextField label="Song title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
                <TextField
                  label="Artist (optional)"
                  maxLength={200}
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                />
              </div>
            )}

            {preview.duplicate ? (
              <p className="text-sm font-semibold text-warn">{preview.duplicate}</p>
            ) : (
              <>
                {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
                <button type="button" className="btn-primary w-full" disabled={busy} onClick={submit}>
                  <MusicPlus width={18} height={18} /> {busy ? 'Sending…' : 'Suggest this song'}
                </button>
              </>
            )}
          </div>
        )}

        {justSent && (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-good">
            <Check width={16} height={16} /> Thanks — the leaders will take a listen.
          </p>
        )}
      </section>

      {/* The team's suggestions */}
      <section className="space-y-3">
        <SegmentedControl options={tabs} value={tab} onChange={setTab} />

        {visible.length === 0 ? (
          <EmptyState
            icon={MusicPlus}
            message={
              tab === 'all' ? 'No suggestions yet. Be the first to share one!' : 'You haven’t suggested any songs yet.'
            }
          />
        ) : (
          visible.map((s) => {
            const canRemove = canManage || (s.suggestedById === meId && s.status === 'open');
            return (
              <article key={s.id} className="card p-3">
                <div className="flex items-center gap-3">
                  <a href={s.url} target="_blank" rel="noreferrer" className="row-press shrink-0" aria-label={`Watch ${s.songTitle} on YouTube`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube still */}
                    <img src={s.thumbnailUrl} alt="" className="aspect-video w-24 rounded-xl bg-surface-2 object-cover" />
                  </a>
                  <div className="min-w-0 flex-1">
                    <a href={s.url} target="_blank" rel="noreferrer" className="block truncate font-semibold">
                      {s.songTitle}
                    </a>
                    {s.artist && <p className="truncate text-sm text-ink-soft">{s.artist}</p>}
                    {/* The age reads the clock and the viewer's time zone, so the
                        server's render can land on a different day around
                        midnight — let the client's value win quietly. */}
                    <p className="mt-0.5 truncate text-xs text-ink-faint" suppressHydrationWarning>
                      {s.suggestedByName.split(' ')[0]} · {formatAge(s.createdAt)}
                    </p>
                  </div>
                  {canRemove && (
                    <button
                      type="button"
                      aria-label="Remove suggestion"
                      onClick={() => setRemoving(s)}
                      className="row-press grid h-9 w-9 shrink-0 place-items-center self-start rounded-xl text-ink-faint"
                    >
                      <Trash width={17} height={17} />
                    </button>
                  )}
                </div>

                {s.status === 'added' && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-good">
                    <Book width={14} height={14} /> In the song library
                  </p>
                )}
                {s.status === 'dismissed' && tab === 'mine' && (
                  <span className="chip mt-3 bg-bad/10 text-bad">Dismissed</span>
                )}

                {canManage && s.status !== 'added' && (
                  <div className="mt-3 flex gap-2">
                    {s.status === 'open' ? (
                      <>
                        <button type="button" className="btn-primary flex-1 !py-2.5 text-sm" onClick={() => setAdding(s)}>
                          <Book width={16} height={16} /> Add to library
                        </button>
                        <button
                          type="button"
                          className="btn-ghost border border-line !py-2.5 text-sm"
                          onClick={() => setStatus(s, 'dismissed')}
                        >
                          Pass
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn-ghost flex-1 border border-line !py-2.5 text-sm"
                        onClick={() => setStatus(s, 'open')}
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      {adding && (
        <AddToLibraryModal
          suggestion={adding}
          onClose={() => setAdding(null)}
          onAdded={(s) => {
            replace(s);
            setAdding(null);
          }}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Remove suggestion?"
        message={removing ? `“${removing.songTitle}” will be removed from the list.` : ''}
        confirmLabel="Remove"
        busy={actionBusy}
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}

/** Leader confirms (and can tidy) the title/artist, then the song is created. */
function AddToLibraryModal({
  suggestion,
  onClose,
  onAdded,
}: {
  suggestion: SongSuggestionDTO;
  onClose: () => void;
  onAdded: (s: SongSuggestionDTO) => void;
}) {
  const [title, setTitle] = useState(suggestion.songTitle);
  const [artist, setArtist] = useState(suggestion.artist ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!title.trim()) return setError('Song title required');
    setBusy(true);
    setError(null);
    try {
      const { suggestion: updated } = await apiFetch<{ suggestion: SongSuggestionDTO }>(
        `/api/suggestions/${suggestion.id}/library`,
        { method: 'POST', body: JSON.stringify({ songTitle: title.trim(), artist: artist.trim() || null }) },
      );
      onAdded(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that song.');
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add to library">
      <div className="space-y-3">
        <TextField label="Song title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextField label="Artist (optional)" maxLength={200} value={artist} onChange={(e) => setArtist(e.target.value)} />
        <p className="text-sm text-ink-faint">
          The YouTube link comes along. Add parts, charts, and band notes from the library afterwards.
        </p>
        {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
        <button type="button" className="btn-primary w-full" disabled={busy} onClick={add}>
          <Book width={18} height={18} /> {busy ? 'Adding…' : 'Add to library'}
        </button>
      </div>
    </Modal>
  );
}
