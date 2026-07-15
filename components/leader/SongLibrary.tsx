'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LibrarySongDTO, SongDTO } from '@/lib/setlist-serialize';
import { AUDIO_PARTS } from '@/lib/setlist-serialize';
import { Overlay } from '@/components/shared/Overlay';
import { FieldLabel } from '@/components/shared/Field';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Skeleton, SkeletonList } from '@/components/shared/Skeleton';
import { SongAudioSlots } from './SongAudioSlots';
import { SongBandFields } from './SongBandFields';
import { LyricChartImport } from './LyricChartImport';
import { SongDetail } from '@/components/shared/SongDetail';
import { Plus, Music, FileText, Pencil, ChevronLeft, Trash, Book } from '@/components/shared/Icons';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';

/** Strip library-only metadata so the song can feed SongDTO-shaped components. */
function libToSong(s: LibrarySongDTO): SongDTO {
  const { usageCount: _u, updatedAt: _up, ...rest } = s;
  return { ...rest, position: 0 };
}

export function SongLibrary() {
  const [songs, setSongs] = useState<LibrarySongDTO[] | null>(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<LibrarySongDTO | 'new' | null>(null);
  const [viewing, setViewing] = useState<SongDTO | null>(null);

  async function load() {
    try {
      const { songs } = await apiFetch<{ songs: LibrarySongDTO[] }>('/api/songs');
      setSongs(songs);
    } catch {
      setSongs([]);
    }
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
      <header className="flex items-end justify-between">
        <div>
          <Link
            href="/dashboard/setlist"
            className="row-press mb-2 -ml-1 grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-soft"
            aria-label="Back to setlists"
          >
            <ChevronLeft width={18} height={18} />
          </Link>
          <h1 className="page-title">Song library</h1>
        </div>
        <button type="button" className="btn-primary !px-4 !py-3" onClick={() => setEditing('new')}>
          <Plus width={18} height={18} /> New
        </button>
      </header>

      {songs === null ? (
        <SkeletonList>
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </SkeletonList>
      ) : songs.length === 0 ? (
        <EmptyState
          icon={Book}
          message="Your library is empty. Add your first song, upload its parts, and it'll be ready for every setlist."
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
              {filtered.map((s) => {
                const partCount = AUDIO_PARTS.filter((p) => s[p]).length;
                return (
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
                        <span className="flex items-center gap-2 text-xs text-ink-faint">
                          {s.artist && <span className="truncate">{s.artist}</span>}
                          <span className="inline-flex items-center gap-1">
                            <Music width={11} height={11} />
                            {partCount}/4
                          </span>
                          {s.lyricChart && (
                            <span className="inline-flex items-center gap-1">
                              <FileText width={11} height={11} /> Chart
                            </span>
                          )}
                          <span>{s.usageCount > 0 ? `In ${s.usageCount} setlist${s.usageCount > 1 ? 's' : ''}` : 'Unused'}</span>
                        </span>
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
                );
              })}
            </div>
          )}
        </>
      )}

      {viewing && <SongDetail song={viewing} onClose={() => setViewing(null)} />}

      {editing && (
        <LibraryEditor
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
  initial,
  onClose,
  onChanged,
  onDeleted,
}: {
  initial: LibrarySongDTO | null;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  // `song` is null until a brand-new song is created; once it exists, the audio
  // and chart sections (which need a saved song id) appear.
  const [song, setSong] = useState<SongDTO | null>(initial ? libToSong(initial) : null);
  const [title, setTitle] = useState(initial?.songTitle ?? '');
  const [artist, setArtist] = useState(initial?.artist ?? '');
  const [youtube, setYoutube] = useState(initial?.youtubeLink ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRetire, setConfirmRetire] = useState(false);

  const usageCount = initial?.usageCount ?? 0;

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
          body: JSON.stringify(details),
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
            <SongAudioSlots song={song} month="library" onChanged={(s) => setSong({ ...song, ...s })} />
            <LyricChartImport song={song} onChanged={(s) => setSong({ ...song, ...s })} />

            <div className="border-t border-line pt-4">
              <button type="button" className="btn-ghost !py-2 text-sm text-bad" onClick={() => setConfirmRetire(true)}>
                <Trash width={15} height={15} /> Retire song
              </button>
              <p className="mt-1.5 text-xs text-ink-faint">
                {usageCount > 0
                  ? `Used in ${usageCount} setlist${usageCount > 1 ? 's' : ''}. Retiring deletes its audio and removes it from those setlists.`
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
            ? `This deletes the song and its audio, and removes it from ${usageCount} setlist${usageCount > 1 ? 's' : ''}. This can't be undone.`
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
