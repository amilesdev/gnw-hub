'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LibrarySongDTO, SongDTO } from '@/lib/setlist-serialize';
import { Overlay } from '@/components/shared/Overlay';
import { FieldLabel } from '@/components/shared/Field';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Skeleton, SkeletonList } from '@/components/shared/Skeleton';
import { SongAudioSlots } from './SongAudioSlots';
import { SongBandFields } from './SongBandFields';
import { LyricChartImport } from '@/components/shared/LyricChartImport';
import { SongDetail } from '@/components/shared/SongDetail';
import { Plus, Music, MusicPlus, Pencil, ChevronLeft, Trash, Book, Sparkle, Upload } from '@/components/shared/Icons';
import { LibraryPicker } from './LibraryPicker';
import { apiFetch } from '@/lib/api-client';
import { crossoverSeasonActive } from '@/lib/crossover-season';
import Link from 'next/link';

type Scope = LibrarySongDTO['scope'];

/**
 * Strip library-only metadata so the song can feed SongDTO-shaped components.
 * `leads` stays empty: who leads a song belongs to a setlist, and the library
 * looks at the song on its own.
 */
function libToSong(s: LibrarySongDTO): SongDTO {
  const { usageCount: _u, updatedAt: _up, lastLeads: _l, scope: _s, ...rest } = s;
  return { ...rest, position: 0, leads: [] };
}

/**
 * A song list and its editor: the Song Library, or (scope "crossover") the
 * separate Crossover song list. Same editor either way — parts, band content
 * and lyric chart — plus a way to copy a song across to the other list.
 */
export function SongLibrary({ scope = 'library' }: { scope?: Scope }) {
  const crossover = scope === 'crossover';
  const [songs, setSongs] = useState<LibrarySongDTO[] | null>(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<LibrarySongDTO | 'new' | null>(null);
  const [viewing, setViewing] = useState<SongDTO | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  async function load() {
    try {
      const { songs } = await apiFetch<{ songs: LibrarySongDTO[] }>(`/api/songs?scope=${scope}`);
      setSongs(songs);
    } catch {
      setSongs([]);
    }
  }

  // "Import from library": each picked Song Library song becomes its own
  // Crossover-list copy, free to be rearranged without touching the original.
  async function importSongs(picked: LibrarySongDTO[]) {
    setImporting(false);
    setImportError(null);
    try {
      for (const s of picked) {
        await apiFetch(`/api/songs/${s.id}/copy`, { method: 'POST', body: JSON.stringify({ to: 'crossover' }) });
      }
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Could not import every song.');
    }
    load();
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const list = songs ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (s) => s.songTitle.toLowerCase().includes(needle) || (s.artist ?? '').toLowerCase().includes(needle),
    );
  }, [songs, q]);

  return (
    <div className="space-y-5 pt-2">
      <header className="flex items-end justify-between gap-2 pr-12">
        <div>
          <Link
            href={crossover ? '/dashboard/crossover/sets' : '/dashboard/setlist'}
            className="row-press mb-2 -ml-1 grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-soft"
            aria-label={crossover ? 'Back to Crossover sets' : 'Back to setlists'}
          >
            <ChevronLeft width={18} height={18} />
          </Link>
          {crossover && <div className="eyebrow mb-2">Crossover</div>}
          <h1 className="page-title">{crossover ? 'Songs' : 'Library'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Icon-only on narrow phones so the header fits beside the floating avatar. */}
          {crossover ? (
            <button
              type="button"
              className="btn-ghost border border-line !px-4 !py-3 max-[389px]:!px-3"
              onClick={() => setImporting(true)}
            >
              <Upload width={18} height={18} /> <span className="max-[389px]:sr-only">Import</span>
            </button>
          ) : (
            <Link href="/dashboard/library/suggestions" className="btn-ghost border border-line !px-4 !py-3 max-[389px]:!px-3">
              <MusicPlus width={18} height={18} /> <span className="max-[389px]:sr-only">Suggest</span>
            </Link>
          )}
          <button type="button" className="btn-primary !px-4 !py-3" onClick={() => setEditing('new')}>
            <Plus width={18} height={18} /> New
          </button>
        </div>
      </header>

      {crossover && (
        <p className="-mt-2 text-sm text-ink-soft">
          Crossover arrangements, kept apart from the Song Library. Import a library song to start from it, or copy a
          Crossover song back from its editor.
        </p>
      )}
      {importError && <p className="text-sm font-semibold text-bad">{importError}</p>}

      {songs === null ? (
        <SkeletonList>
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </SkeletonList>
      ) : songs.length === 0 ? (
        <EmptyState
          icon={crossover ? Sparkle : Book}
          message={
            crossover
              ? 'No Crossover songs yet. Add one, or import a song from the library to start from it.'
              : "Your library is empty. Add your first song, upload its parts, and it'll be ready for every setlist."
          }
        />
      ) : (
        <>
          <input
            className="field"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search songs or artists…"
            enterKeyHint="search"
          />

          {filtered.length === 0 ? (
            <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-faint">No songs match that search.</p>
          ) : (
            <div className="card overflow-hidden">
              {filtered.map((s) => (
                <div key={s.id} className="flex items-center border-b border-line last:border-0">
                  {/* Tap the row to view the song read-only; pencil opens the editor. */}
                  <button
                    type="button"
                    onClick={() => setViewing(libToSong(s))}
                    className="row-press flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent-ink dark:text-accent-on">
                      <Music width={16} height={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{s.songTitle}</span>
                      {s.artist && <span className="block truncate text-xs text-ink-faint">{s.artist}</span>}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    className="row-press mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-soft"
                    aria-label={`Edit ${s.songTitle}`}
                  >
                    <Pencil width={16} height={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {viewing && <SongDetail song={viewing} onClose={() => setViewing(null)} />}

      {importing && (
        <LibraryPicker
          title="Import from library"
          actionLabel="Import"
          excludeIds={new Set()}
          onAdd={importSongs}
          onClose={() => setImporting(false)}
        />
      )}

      {editing && (
        <LibraryEditor
          scope={scope}
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onChanged={load}
          onDeleted={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function LibraryEditor({
  scope,
  initial,
  onClose,
  onChanged,
  onDeleted,
}: {
  scope: Scope;
  initial: LibrarySongDTO | null;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const crossover = scope === 'crossover';
  // `song` is null until a brand-new song is created; once it exists, the audio
  // and chart sections (which need a saved song id) appear.
  const [song, setSong] = useState<SongDTO | null>(initial ? libToSong(initial) : null);
  const [title, setTitle] = useState(initial?.songTitle ?? '');
  const [artist, setArtist] = useState(initial?.artist ?? '');
  const [youtube, setYoutube] = useState(initial?.youtubeLink ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [copied, setCopied] = useState(false);

  const usageCount = initial?.usageCount ?? 0;
  const usedIn = crossover
    ? `${usageCount} Crossover set${usageCount > 1 ? 's' : ''}`
    : `${usageCount} setlist${usageCount > 1 ? 's' : ''}`;
  // A Crossover song can always go to the Song Library; a library song can go
  // to the Crossover list while a season is running.
  const canCopy = crossover || crossoverSeasonActive();

  // Copy this song into the other list as a separate song (it starts with the
  // same parts, band content and chart, then the two go their own ways).
  async function copyAcross() {
    if (!song) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/songs/${song.id}/copy`, {
        method: 'POST',
        body: JSON.stringify({ to: crossover ? 'library' : 'crossover' }),
      });
      setCopied(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not copy the song.');
    } finally {
      setBusy(false);
    }
  }

  const details = {
    songTitle: title.trim(),
    artist: artist.trim() || null,
    youtubeLink: youtube.trim() || null,
  };

  async function saveDetails() {
    if (!details.songTitle) {
      setError('Song title required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (song) {
        await apiFetch(`/api/songs/${song.id}`, { method: 'PATCH', body: JSON.stringify(details) });
        setSong({ ...song, ...details });
      } else {
        const { song: created } = await apiFetch<{ song: LibrarySongDTO }>('/api/songs', {
          method: 'POST',
          body: JSON.stringify({ ...details, scope }),
        });
        setSong(libToSong(created));
      }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function retire() {
    if (!song) return;
    setBusy(true);
    try {
      await apiFetch(`/api/songs/${song.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not retire song.');
      setBusy(false);
    }
  }

  return (
    <Overlay
      title={initial ? initial.songTitle : 'New song'}
      onClose={onClose}
      action={
        <button type="button" className="btn-primary !px-4 !py-2.5" disabled={busy} onClick={saveDetails}>
          {busy ? 'Saving…' : song ? 'Save' : 'Create'}
        </button>
      }
    >
      <div className="space-y-5">
        <div className="space-y-3">
          <div>
            <FieldLabel>Title</FieldLabel>
            <input className="field mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Song title" enterKeyHint="next" />
          </div>
          <div>
            <FieldLabel>Artist</FieldLabel>
            <input className="field mt-1.5" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist / arranger" enterKeyHint="next" />
          </div>
          <div>
            <FieldLabel>YouTube link</FieldLabel>
            <input className="field mt-1.5 text-sm" value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="https://youtube.com/…" inputMode="url" enterKeyHint="done" />
          </div>
        </div>

        {error && <p className="text-sm font-semibold text-bad">{error}</p>}

        {/* Key/BPM + arrangement sit right after the YouTube link (once saved). */}
        {song && <SongBandFields song={song} onChanged={(s) => setSong({ ...song, ...s })} />}

        {song ? (
          <div className="space-y-4">
            <SongAudioSlots song={song} month={crossover ? 'crossover' : 'library'} onChanged={(s) => setSong({ ...song, ...s })} />
            <LyricChartImport song={song} onChanged={(s) => setSong({ ...song, ...s })} />

            {canCopy && (
              <div className="border-t border-line pt-4">
                <button type="button" className="btn-ghost !py-2 text-sm" onClick={copyAcross} disabled={busy || copied}>
                  {crossover ? <Book width={15} height={15} /> : <Sparkle width={15} height={15} />}
                  {copied ? 'Copied' : crossover ? 'Copy to Song Library' : 'Copy to Crossover songs'}
                </button>
                <p className="mt-1.5 text-xs text-ink-faint">
                  {copied
                    ? `A copy is now in the ${crossover ? 'Song Library' : 'Crossover song list'}.`
                    : `Adds a separate copy to the ${crossover ? 'Song Library' : 'Crossover song list'} with the same parts and chart. Changing one won’t change the other.`}
                </p>
              </div>
            )}

            <div className="border-t border-line pt-4">
              <button type="button" className="btn-ghost !py-2 text-sm text-bad" onClick={() => setConfirmRetire(true)}>
                <Trash width={15} height={15} /> Retire song
              </button>
              <p className="mt-1.5 text-xs text-ink-faint">
                {usageCount > 0
                  ? `Used in ${usedIn}. Retiring deletes its audio and removes it from ${usageCount > 1 ? 'those' : 'it'}.`
                  : 'Deletes this song and its uploaded audio for good.'}
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-2xl bg-surface-2 px-4 py-4 text-center text-sm text-ink-faint">
            Create the song first, then upload its vocal parts and import a lyric chart.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmRetire}
        title="Retire this song?"
        message={
          usageCount > 0
            ? `This deletes the song and its audio, and removes it from ${usedIn}. This can't be undone.`
            : "This deletes the song and its uploaded audio. This can't be undone."
        }
        confirmLabel="Retire"
        busy={busy}
        onConfirm={retire}
        onClose={() => setConfirmRetire(false)}
      />
    </Overlay>
  );
}
