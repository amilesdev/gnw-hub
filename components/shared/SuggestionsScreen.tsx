'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SongSuggestionDTO } from '@/lib/serialize';
import { MusicPlus, Pencil, Trash, Check, X, Book } from './Icons';
import { ScreenHeader } from './ScreenHeader';
import { useToast } from './Toast';
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
  scope = 'library',
}: {
  canManage: boolean;
  meId: string;
  initialSuggestions: SongSuggestionDTO[];
  /** The screen this one opens from (the Song Library, or the Crossover tab). */
  backHref: string;
  /** Which list: Song Library suggestions, or Crossover's (added to the Crossover songs). */
  scope?: SongSuggestionDTO['scope'];
}) {
  const crossover = scope === 'crossover';
  const listName = crossover ? 'Crossover songs' : 'library';
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
  const toast = useToast();

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
        const p = await apiFetch<Preview>(`/api/suggestions/preview?url=${encodeURIComponent(trimmed)}&scope=${scope}`);
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
  }, [link, scope]);

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
        body: JSON.stringify({ url: preview.url, songTitle: title.trim(), artist: artist.trim(), scope }),
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

  // Pass hides the card at once; the request goes out when the undo toast
  // closes without Undo (CMP-22), so a mis-tap costs nothing.
  function pass(s: SongSuggestionDTO) {
    replace({ ...s, status: 'dismissed' });
    toast.show({
      message: `Passed on “${s.songTitle}”.`,
      undo: () => replace(s),
      commit: () =>
        apiFetch<{ suggestion: SongSuggestionDTO }>(`/api/suggestions/${s.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'dismissed' }),
        })
          .then(({ suggestion }) => replace(suggestion))
          .catch(() => replace(s)),
    });
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
    { value: 'mine', label: 'My suggestions' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <ScreenHeader
          back={{ href: backHref, label: crossover ? 'Crossover' : 'Library' }}
          eyebrow={crossover ? 'Crossover' : undefined}
          title="Suggestions"
          className="mb-0"
        />
        <p className="mt-2 text-[15px] leading-[22px] text-ink-soft">
          {crossover
            ? 'Got a song in mind for Crossover? Paste a YouTube link to suggest it.'
            : 'Paste a YouTube link to suggest a song for the library.'}
        </p>
      </div>

      {/* Composer */}
      <section className="card space-y-3.5 p-4">
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
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-ink-faint"
            >
              <X width={18} height={18} />
            </button>
          )}
        </div>

        {looking && <p className="text-sm text-ink-faint">Looking it up…</p>}
        {previewError && <p role="alert" className="text-sm font-semibold text-bad-ink">{previewError}</p>}

        {preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube still */}
              <img
                src={preview.thumbnailUrl}
                alt=""
                className="h-[63px] w-28 shrink-0 rounded-xl bg-surface-2 object-cover"
              />
              <div className="min-w-0 flex-1">
                {preview.found ? (
                  <>
                    <p className="row-title truncate">{title || 'Untitled'}</p>
                    <p className="truncate text-sm text-ink-soft">{artist || 'Unknown artist'}</p>
                  </>
                ) : (
                  <p className="text-sm text-ink-soft">Couldn’t read the video details. Add them below.</p>
                )}
                {preview.found && !editing && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-accent-ink"
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
              <p className="rounded-[14px] bg-warn/10 p-3 text-sm font-semibold text-warn-ink">{preview.duplicate}</p>
            ) : (
              <>
                {error && <p role="alert" className="text-sm font-semibold text-bad-ink">{error}</p>}
                <button type="button" className="btn-primary w-full" disabled={busy} onClick={submit}>
                  <MusicPlus width={18} height={18} /> {busy ? 'Sending…' : 'Suggest this song'}
                </button>
              </>
            )}
          </div>
        )}

        {justSent && (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-good-ink">
            <Check width={16} height={16} /> Thanks. The leaders will take a listen.
          </p>
        )}
      </section>

      {/* The team's suggestions */}
      <section className="space-y-3">
        <SegmentedControl options={tabs} value={tab} onChange={setTab} aria-label="Which suggestions" />

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
              <article key={s.id} className="card animate-rise p-3">
                <div className="flex items-center gap-3">
                  <a href={s.url} target="_blank" rel="noreferrer" className="row-press shrink-0" aria-label={`Watch ${s.songTitle} on YouTube`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube still */}
                    <img src={s.thumbnailUrl} alt="" className="h-[54px] w-24 rounded-xl bg-surface-2 object-cover" />
                  </a>
                  <div className="min-w-0 flex-1">
                    <a href={s.url} target="_blank" rel="noreferrer" className="row-title block truncate">
                      {s.songTitle}
                    </a>
                    {s.artist && <p className="truncate text-sm text-ink-soft">{s.artist}</p>}
                    {/* The age reads the clock and the viewer's time zone, so the
                        server's render can land on a different day around
                        midnight — let the client's value win quietly. */}
                    <p className="mt-0.5 truncate text-[13px] leading-[18px] text-ink-faint" suppressHydrationWarning>
                      {s.suggestedByName.split(' ')[0]} · {formatAge(s.createdAt)}
                    </p>
                  </div>
                  {canRemove && (
                    <button
                      type="button"
                      aria-label="Remove suggestion"
                      onClick={() => setRemoving(s)}
                      className="btn-icon -mr-1 -mt-1 shrink-0 self-start text-ink-faint"
                    >
                      <Trash width={18} height={18} />
                    </button>
                  )}
                </div>

                {s.status === 'added' && (
                  <span className="chip mt-3 bg-accent-soft text-accent-ink">
                    <Check width={13} height={13} strokeWidth={2} /> {crossover ? 'In the Crossover songs' : 'In the song library'}
                  </span>
                )}
                {s.status === 'dismissed' && tab === 'mine' && (
                  <span className="chip mt-3 bg-bad/[0.14] text-bad-ink">Dismissed</span>
                )}

                {canManage && s.status !== 'added' && (
                  <div className="mt-3 flex gap-2.5">
                    {s.status === 'open' ? (
                      <>
                        <button type="button" className="btn-primary btn-sm flex-1" onClick={() => setAdding(s)}>
                          <Book width={16} height={16} /> Add to {listName}
                        </button>
                        <button type="button" className="btn-outline btn-sm" onClick={() => pass(s)}>
                          Pass
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn-outline btn-sm"
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
          listName={listName}
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
  listName,
  suggestion,
  onClose,
  onAdded,
}: {
  listName: string;
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
    <Modal open onClose={onClose} title={`Add to ${listName}`}>
      <div className="space-y-3">
        <TextField label="Song title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextField label="Artist (optional)" maxLength={200} value={artist} onChange={(e) => setArtist(e.target.value)} />
        <p className="text-sm text-ink-faint">
          The YouTube link comes along. Add parts, charts, and band notes from the {listName} afterwards.
        </p>
        {error && <p role="alert" className="text-sm font-semibold text-bad-ink">{error}</p>}
        <button type="button" className="btn-primary w-full" disabled={busy} onClick={add}>
          <Book width={18} height={18} /> {busy ? 'Adding…' : `Add to ${listName}`}
        </button>
      </div>
    </Modal>
  );
}
