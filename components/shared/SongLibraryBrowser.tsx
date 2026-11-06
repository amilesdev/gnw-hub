'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LibrarySongDTO, SongDTO } from '@/lib/setlist-serialize';
import { SongDetail } from './SongDetail';
import { EmptyState, InlineEmpty } from './EmptyState';
import { SetlistSkeleton } from './Skeleton';
import { ChevronRight, Book } from './Icons';
import { SearchField } from './SearchField';
import { apiFetch } from '@/lib/api-client';
import { useDataChanged } from '@/lib/data-changed';
import { listCard } from '@/lib/ui-classes';

/**
 * Strip library-only metadata so a song can feed the SongDetail view. `leads`
 * stays empty: who leads a song belongs to a setlist, and the library looks at
 * the song on its own.
 */
function libToSong(s: LibrarySongDTO): SongDTO {
  const { usageCount: _u, updatedAt: _up, lastLeads: _l, ...rest } = s;
  return { ...rest, position: 0, leads: [] };
}

/** Library row (CMP-11): title + artist. `trailing` replaces the chevron. */
export function LibraryRow({
  song,
  onClick,
  trailing,
}: {
  song: LibrarySongDTO;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[60px] items-center">
      <button type="button" onClick={onClick} className="row-press flex min-w-0 flex-1 items-center gap-3 self-stretch py-2.5 pl-4 pr-2 text-left">
        <span className="min-w-0 flex-1">
          <span className="row-title block truncate">{song.songTitle}</span>
          {song.artist && <span className="block truncate text-[13px] leading-[18px] text-ink-soft">{song.artist}</span>}
        </span>
        {!trailing && <ChevronRight width={18} height={18} className="mr-2 shrink-0 text-ink-faint" aria-hidden />}
      </button>
      {trailing}
    </div>
  );
}

/** Title or artist contains the search text. */
export function useLibraryFilter(songs: LibrarySongDTO[] | null, q: string) {
  return useMemo(() => {
    const list = songs ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (s) => s.songTitle.toLowerCase().includes(needle) || (s.artist ?? '').toLowerCase().includes(needle),
    );
  }, [songs, q]);
}

/**
 * Songs › Library for members (SG-4): search, browse, and open a song to review
 * its lyric chart or listen to the parts. Read-only, except that the song sheet
 * itself lets the vocal director manage the vocal parts; editing the song
 * *entry* still lives in the leader-only `SongLibrary`. The Songs tab supplies
 * the header and keeps the search text.
 */
export function SongLibraryBrowser({ q, onQChange }: { q: string; onQChange: (q: string) => void }) {
  const [songs, setSongs] = useState<LibrarySongDTO[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<SongDTO | null>(null);

  function load(quiet = false) {
    setFailed(false);
    return apiFetch<{ songs: LibrarySongDTO[] }>('/api/songs')
      .then(({ songs }) => setSongs(songs))
      .catch(() => {
        // A failed background refresh keeps the list; a failed first load says so.
        if (!quiet) setFailed(true);
      });
  }

  useEffect(() => {
    void load();
  }, []);

  // A save from a song sheet (vocal parts, a lyric chart).
  useDataChanged(() => {
    void load(true);
  });

  const filtered = useLibraryFilter(songs, q);

  return (
    <div className="space-y-4">
      <SearchField value={q} onChange={onQChange} placeholder="Search songs or artists…" />

      {failed ? (
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
        <EmptyState icon={Book} message="No songs in the library yet. Your leaders will add them here." />
      ) : filtered.length === 0 ? (
        <InlineEmpty>No songs match that search.</InlineEmpty>
      ) : (
        <div className={listCard}>
          {filtered.map((s) => (
            <LibraryRow key={s.id} song={s} onClick={() => setOpen(libToSong(s))} />
          ))}
        </div>
      )}

      {open && <SongDetail song={open} context={{ fromLibrary: true }} onClose={() => setOpen(null)} />}
    </div>
  );
}
