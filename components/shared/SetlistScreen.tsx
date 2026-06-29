'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SetlistDTO, SongDTO } from '@/lib/setlist-serialize';
import { SongDetail } from './SongDetail';
import { EmptyState } from './EmptyState';
import { Music, ChevronRight, Clock } from './Icons';
import { apiFetch } from '@/lib/api-client';
import { formatMonthLabel, monthKey, formatEventDate } from '@/lib/dates';

export function SetlistScreen() {
  const [setlists, setSetlists] = useState<SetlistDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMonth, setActiveMonth] = useState<string>(monthKey());
  const [song, setSong] = useState<SongDTO | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { setlists } = await apiFetch<{ setlists: SetlistDTO[] }>('/api/setlists');
        setSetlists(setlists);
        if (setlists.length && !setlists.some((s) => s.month === monthKey())) {
          setActiveMonth(setlists[0].month);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const months = useMemo(() => Array.from(new Set(setlists.map((s) => s.month))).sort().reverse(), [setlists]);
  const monthSetlists = setlists.filter((s) => s.month === activeMonth && s.songs.length > 0);

  return (
    <div className="space-y-5 pt-2">
      <header>
        <div className="eyebrow">GNW</div>
        <h1 className="page-title mt-2">Setlist</h1>
      </header>

      {months.length > 1 && (
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {months.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setActiveMonth(m)}
              className={
                m === activeMonth
                  ? 'chip shrink-0 bg-accent px-3.5 py-2 text-white'
                  : 'chip shrink-0 bg-surface-2 px-3.5 py-2 text-ink-soft'
              }
            >
              {formatMonthLabel(m)}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="h-2 w-24 animate-breathe rounded-full bg-accent/30" />
      ) : monthSetlists.length === 0 ? (
        <EmptyState icon={Clock} message="No setlist for this month yet. Sit tight — your leaders are picking the songs." />
      ) : (
        <div className="space-y-6">
          {monthSetlists.map((sl) => (
            <section key={sl.id} className="space-y-3">
              <div>
                <h2 className="font-display text-xl font-semibold">
                  {sl.events.length
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
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 font-display font-semibold text-accent-ink">
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
