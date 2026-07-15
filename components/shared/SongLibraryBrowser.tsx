'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { LibrarySongDTO, SongDTO } from '@/lib/setlist-serialize';
import { SongDetail } from './SongDetail';
import { EmptyState } from './EmptyState';
import { Skeleton, SkeletonList } from './Skeleton';
import { Music, ChevronRight, ChevronLeft, Book } from './Icons';
import { apiFetch } from '@/lib/api-client';

/** Strip library-only metadata so a song can feed the read-only SongDetail view. */
function libToSong(s: LibrarySongDTO): SongDTO {
  const { usageCount: _u, updatedAt: _up, ...rest } = s;
  return { ...rest, position: 0 };
}

/**
 * Read-only library browser for members: search, browse, and open a song to
 * review its lyric chart or listen to the parts. No editing — that lives in the
 * leader-only `SongLibrary`.
 */
export function SongLibraryBrowser({ backHref }: { backHref: string }) {
  const [songs, setSongs] = useState<LibrarySongDTO[] | null>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<SongDTO | null>(null);

  useEffect(() => {
    apiFetch<{ songs: LibrarySongDTO[] }>('/api/songs')
      .then(({ songs }) => setSongs(songs))
      .catch(() => setSongs([]));
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
      <header className="flex items-center gap-3">
        <Link
          href={backHref}
          className="row-press grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-soft"
          aria-label="Back"
        >
          <ChevronLeft width={18} height={18} />
        </Link>
        <h1 className="page-title">Song library</h1>
      </header>

      {songs === null ? (
        <SkeletonList>
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </SkeletonList>
      ) : songs.length === 0 ? (
        <EmptyState icon={Book} message="No songs in the library yet. Your leaders will add them here." />
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
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setOpen(libToSong(s))}
                  className="row-press flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left last:border-0"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent-ink dark:text-accent-on">
                    <Music width={16} height={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{s.songTitle}</span>
                    {s.artist && <span className="block truncate text-xs text-ink-faint">{s.artist}</span>}
                  </span>
                  <ChevronRight width={20} height={20} className="text-ink-faint" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {open && <SongDetail song={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
