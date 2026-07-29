'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SetlistDTO, SongDTO } from '@/lib/setlist-serialize';
import { SongDetail } from './SongDetail';
import { EmptyState } from './EmptyState';
import { Skeleton, SetlistSkeleton, SkeletonList } from './Skeleton';
import { Music, ChevronRight, Clock, Book } from './Icons';
import { apiFetch } from '@/lib/api-client';
import { formatEventDate } from '@/lib/dates';

export function SetlistScreen({ initialSetlists }: { initialSetlists?: SetlistDTO[] } = {}) {
  const [setlists, setSetlists] = useState<SetlistDTO[]>(initialSetlists ?? []);
  const [loading, setLoading] = useState(initialSetlists === undefined);
  const [song, setSong] = useState<SongDTO | null>(null);

  useEffect(() => {
    if (initialSetlists !== undefined) return; // already seeded on the server — skip the fetch
    (async () => {
      try {
        const { setlists } = await apiFetch<{ setlists: SetlistDTO[] }>('/api/setlists');
        setSetlists(setlists);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One flat list, soonest date first (the API/server already orders it so).
  const visibleSetlists = setlists.filter((s) => s.songs.length > 0);

  return (
    <div className="space-y-5 pt-2">
      <header className="flex items-end justify-between">
        <div>
          <div className="eyebrow">GNW Hub</div>
          <h1 className="page-title mt-2">Setlist</h1>
        </div>
        <Link href="/home/library" className="btn-ghost !px-4 !py-3 border border-line">
          <Book width={18} height={18} /> Library
        </Link>
      </header>

      {loading ? (
        <SkeletonList>
          <Skeleton className="h-6 w-44" />
          <SetlistSkeleton />
        </SkeletonList>
      ) : visibleSetlists.length === 0 ? (
        <EmptyState icon={Clock} message="No setlists yet. Sit tight — your leaders are picking the songs." />
      ) : (
        <div className="space-y-6">
          {visibleSetlists.map((sl) => (
            <section key={sl.id} className="space-y-3">
              <div>
                <h2 className="font-display text-xl font-semibold">
                  {sl.name
                    ? sl.name
                    : sl.events.length
                      ? Array.from(new Set(sl.events.map((e) => e.eventName))).join(' · ')
                      : 'Setlist'}
                </h2>
                {sl.events.length > 0 && (
                  <p className="text-sm text-ink-faint">
                    {sl.events.map((e) => formatEventDate(new Date(e.date))).join(' • ')}
                  </p>
                )}
              </div>
              <div className="card overflow-hidden">
                {sl.songs.map((s, i) => {
                  const partCount = [s.audioSoprano, s.audioAlto, s.audioTenor, s.audioAllParts].filter(Boolean).length;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSong(s)}
                      className="row-press flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left last:border-0"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 font-display font-semibold text-accent-ink dark:text-accent-on">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{s.songTitle}</span>
                        <span className="flex items-center gap-1 text-xs text-ink-faint">
                          <Music width={12} height={12} />
                          {partCount > 0 ? `${partCount} part${partCount > 1 ? 's' : ''} available` : 'Audio coming soon'}
                        </span>
                      </span>
                      <ChevronRight width={20} height={20} className="text-ink-faint" />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {song && <SongDetail song={song} onClose={() => setSong(null)} />}
    </div>
  );
}
