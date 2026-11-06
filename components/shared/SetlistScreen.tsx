'use client';

import { useEffect, useState } from 'react';
import type { SetlistDTO, SongDTO } from '@/lib/setlist-serialize';
import type { SongSheetContext } from './AudioProvider';
import { SongDetail } from './SongDetail';
import { EmptyState } from './EmptyState';
import { SetlistSkeleton, SkeletonList, Skeleton } from './Skeleton';
import { SongRow } from './HomeSections';
import { setlistTitle } from '@/lib/setlist-title';
import { Clock } from './Icons';
import { apiFetch } from '@/lib/api-client';
import { useDataChanged } from '@/lib/data-changed';
import { formatEventDate } from '@/lib/dates';
import { listCard } from '@/lib/ui-classes';
import { cn } from '@/lib/utils';

/** Heading for one setlist: its name (Literata) and its dates joined " · ". */
export function SetlistHeading({ setlist, action }: { setlist: SetlistDTO; action?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <h2 className="t-title">{setlistTitle(setlist, 'Unlinked setlist')}</h2>
        {setlist.events.length > 0 && (
          <p className="text-sm text-ink-faint">
            {setlist.events.map((e) => formatEventDate(new Date(e.date))).join(' · ')}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/** The song rows card for one setlist, opening each song with its context. */
export function SetlistSongs({
  setlist,
  onSong,
}: {
  setlist: SetlistDTO;
  onSong: (song: SongDTO, context: SongSheetContext) => void;
}) {
  const total = setlist.songs.length;
  return (
    <div className={cn(listCard, 'animate-rise')}>
      {setlist.songs.map((s, i) => (
        <SongRow
          key={s.id}
          song={s}
          index={i}
          onClick={() =>
            onSong(s, { backLabel: 'Setlist', eyebrow: `${setlistTitle(setlist)} · Song ${i + 1} of ${total}` })
          }
        />
      ))}
    </div>
  );
}

/** Songs › Setlists for members (SG-1). The Songs tab supplies the header. */
export function SetlistScreen({ initialSetlists }: { initialSetlists?: SetlistDTO[] } = {}) {
  const [setlists, setSetlists] = useState<SetlistDTO[]>(initialSetlists ?? []);
  const [loading, setLoading] = useState(initialSetlists === undefined);
  const [open, setOpen] = useState<{ song: SongDTO; context: SongSheetContext } | null>(null);

  async function load() {
    try {
      const { setlists } = await apiFetch<{ setlists: SetlistDTO[] }>('/api/setlists');
      setSetlists(setlists);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialSetlists !== undefined) return; // already seeded on the server — skip the fetch
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A save elsewhere (vocal parts, a lyric chart, the setlist itself) or a newer copy.
  useDataChanged(() => {
    load().catch(() => {});
  });

  // One flat list, soonest date first (the API/server already orders it so).
  const visibleSetlists = setlists.filter((s) => s.songs.length > 0);

  return (
    <>
      {loading ? (
        <SkeletonList>
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3.5 w-24" />
          <SetlistSkeleton />
        </SkeletonList>
      ) : visibleSetlists.length === 0 ? (
        <EmptyState icon={Clock} message="No setlists yet. Sit tight. Your leaders are picking the songs." />
      ) : (
        <div className="space-y-6">
          {visibleSetlists.map((sl) => (
            <section key={sl.id} className="space-y-3">
              <SetlistHeading setlist={sl} />
              <SetlistSongs setlist={sl} onSong={(song, context) => setOpen({ song, context })} />
            </section>
          ))}
        </div>
      )}

      {open && <SongDetail song={open.song} context={open.context} onClose={() => setOpen(null)} />}
    </>
  );
}
