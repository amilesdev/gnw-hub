'use client';

import { useEffect, useState } from 'react';
import type { LibrarySongDTO, SongDTO } from '@/lib/setlist-serialize';
import { Overlay } from '@/components/shared/Overlay';
import { TextField } from '@/components/shared/Field';
import { EmptyState, InlineEmpty } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { SetlistSkeleton } from '@/components/shared/Skeleton';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { SearchField } from '@/components/shared/SearchField';
import { LibraryRow, useLibraryFilter } from '@/components/shared/SongLibraryBrowser';
import { SongAudioSlots } from './SongAudioSlots';
import { SongBandFields } from './SongBandFields';
import { LyricChartImport } from '@/components/shared/LyricChartImport';
import { SongDetail } from '@/components/shared/SongDetail';
import { Plus, Pencil, Trash, Book, Sparkle, Upload } from '@/components/shared/Icons';
import { LibraryPicker } from './LibraryPicker';
import { apiFetch } from '@/lib/api-client';
import { useDataChanged } from '@/lib/data-changed';
import { crossoverSeasonActive } from '@/lib/crossover-season';
import { listCard } from '@/lib/ui-classes';

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
 *
 * `inTab`: Songs › Library for leaders (SG-5). The Songs tab supplies the
 * header (Suggest + New → `creating`) and keeps the search text. Standalone
 * (the Crossover list) it draws its own header.
 */
export function SongLibrary({
  scope = 'library',
  inTab = false,
  q: tabQ,
  onQChange,
  creating = false,
  onCreatingChange,
}: {
  scope?: Scope;
  inTab?: boolean;
  q?: string;
  onQChange?: (q: string) => void;
  creating?: boolean;
  onCreatingChange?: (v: boolean) => void;
}) {
  const crossover = scope === 'crossover';
  const [songs, setSongs] = useState<LibrarySongDTO[] | null>(null);
  const [ownQ, setOwnQ] = useState('');
  const q = tabQ ?? ownQ;
  const setQ = onQChange ?? setOwnQ;
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditingState] = useState<LibrarySongDTO | 'new' | null>(null);
  const setEditing = (v: LibrarySongDTO | 'new' | null) => {
    setEditingState(v);
    if (v === null) onCreatingChange?.(false);
  };
  useEffect(() => {
    if (creating) setEditingState('new');
  }, [creating]);
  const [viewing, setViewing] = useState<SongDTO | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  /** `quiet` (a background refresh) keeps the current list if the reload fails. */
  async function load(quiet = false) {
    setLoadFailed(false);
    try {
      const { songs } = await apiFetch<{ songs: LibrarySongDTO[] }>(`/api/songs?scope=${scope}`);
      setSongs(songs);
    } catch {
      if (!quiet) setLoadFailed(true);
    }
  }

  // A save from a song card (vocal parts, a lyric chart) or elsewhere.
  useDataChanged(() => {
    void load(true);
  });

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

  const filtered = useLibraryFilter(songs, q);

  return (
    <div className="space-y-4">
      {!inTab && (
        <ScreenHeader
          back={{ href: '/dashboard/crossover/sets', label: 'Sets' }}
          eyebrow="Crossover"
          title="Songs"
          className="mb-2"
          actions={
            <>
              {/* Icon-only below 390pt so the header fits. */}
              <button
                type="button"
                className="btn-outline btn-sm h-11 max-[389px]:w-11 max-[389px]:px-0"
                onClick={() => setImporting(true)}
                aria-label="Import from library"
              >
                <Upload width={16} height={16} /> <span className="max-[389px]:hidden">Import</span>
              </button>
              <button type="button" className="btn-primary btn-sm h-11" onClick={() => setEditing('new')}>
                <Plus width={16} height={16} /> New
              </button>
            </>
          }
        />
      )}

      {crossover && (
        <p className="text-sm text-ink-soft">
          Crossover arrangements, kept apart from the Song Library. Import a library song to start from it, or copy a
          Crossover song back from its editor.
        </p>
      )}
      {importError && <p role="alert" className="text-[13px] font-semibold text-bad-ink">{importError}</p>}

      <SearchField value={q} onChange={setQ} placeholder="Search songs or artists…" />

      {loadFailed ? (
        <InlineEmpty>
          Could not load the library.
          <button type="button" className="btn-ghost btn-sm mx-auto mt-3 flex" onClick={() => void load()}>
            Try again
          </button>
        </InlineEmpty>
      ) : songs === null ? (
        <div role="status" aria-label="Loading">
          <SetlistSkeleton rows={6} />
        </div>
      ) : songs.length === 0 ? (
        <EmptyState
          icon={crossover ? Sparkle : Book}
          message={
            crossover
              ? 'No Crossover songs yet. Add one, or import a song from the library to start from it.'
              : "Your library is empty. Add your first song, upload its parts, and it'll be ready for every setlist."
          }
        />
      ) : filtered.length === 0 ? (
        <InlineEmpty>No songs match that search.</InlineEmpty>
      ) : (
        <div className={listCard}>
          {filtered.map((s) => (
            // Tap the row to view the song read-only; the pencil opens the editor.
            <LibraryRow
              key={s.id}
              song={s}
              onClick={() => setViewing(libToSong(s))}
              trailing={
                <button
                  type="button"
                  onClick={() => setEditing(s)}
                  className="btn-icon mr-1.5"
                  aria-label={`Edit ${s.songTitle}`}
                >
                  <Pencil width={20} height={20} />
                </button>
              }
            />
          ))}
        </div>
      )}

      {viewing && <SongDetail song={viewing} context={{ fromLibrary: true, backLabel: crossover ? 'Songs' : 'Library' }} onClose={() => setViewing(null)} />}

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
      backLabel={crossover ? 'Songs' : 'Library'}
      action={
        <button type="button" className="btn-primary btn-sm h-11 min-w-[76px]" disabled={busy} onClick={saveDetails}>
          {busy ? 'Saving…' : song ? 'Save' : 'Create'}
        </button>
      }
    >
      <div className="space-y-6">
        <div className="space-y-4">
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Song title" enterKeyHint="next" />
          <TextField label="Artist" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist / arranger" enterKeyHint="next" />
          <TextField
            label="YouTube link"
            value={youtube}
            onChange={(e) => setYoutube(e.target.value)}
            placeholder="https://youtube.com/…"
            inputMode="url"
            enterKeyHint="done"
          />
        </div>

        {error && <p role="alert" className="text-[13px] font-semibold text-bad-ink">{error}</p>}

        {/* Key/BPM + arrangement sit right after the YouTube link (once saved). */}
        {song && <SongBandFields song={song} onChanged={(s) => setSong({ ...song, ...s })} />}

        {song ? (
          <div className="space-y-6">
            <SongAudioSlots song={song} month={crossover ? 'crossover' : 'library'} onChanged={(s) => setSong({ ...song, ...s })} />
            <LyricChartImport song={song} onChanged={(s) => setSong({ ...song, ...s })} />

            {canCopy && (
              <div className="border-t border-line pt-4">
                <button type="button" className="btn-ghost btn-sm" onClick={copyAcross} disabled={busy || copied}>
                  {crossover ? <Book width={16} height={16} /> : <Sparkle width={16} height={16} />}
                  {copied ? 'Copied' : crossover ? 'Copy to Song Library' : 'Copy to Crossover songs'}
                </button>
                <p className="mt-1.5 text-[13px] leading-[18px] text-ink-faint">
                  {copied
                    ? `A copy is now in the ${crossover ? 'Song Library' : 'Crossover song list'}.`
                    : `Adds a separate copy to the ${crossover ? 'Song Library' : 'Crossover song list'} with the same parts and chart. Changing one won’t change the other.`}
                </p>
              </div>
            )}

            <div className="border-t border-line pt-4">
              <button type="button" className="btn-danger-text btn-sm" onClick={() => setConfirmRetire(true)}>
                <Trash width={16} height={16} /> Retire song
              </button>
              <p className="mt-1.5 text-[13px] leading-[18px] text-ink-faint">
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
