'use client';

import { useEffect, useState } from 'react';
import type { SetlistDTO, SongDTO } from '@/lib/setlist-serialize';
import { AUDIO_PARTS } from '@/lib/setlist-serialize';
import { SetlistForm } from './SetlistForm';
import { SongDetail } from '@/components/shared/SongDetail';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton, SetlistSkeleton, SkeletonList } from '@/components/shared/Skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Plus, Pencil, Trash, Music, ChevronRight } from '@/components/shared/Icons';
import { apiFetch } from '@/lib/api-client';
import { formatMonthLabel, formatEventDate } from '@/lib/dates';

type FormState = { mode: 'create' } | { mode: 'edit'; setlist: SetlistDTO } | null;

/** Group setlists into ordered [month, setlists] pairs (input is pre-sorted by the API). */
function groupByMonth(setlists: SetlistDTO[]): [string, SetlistDTO[]][] {
  const map = new Map<string, SetlistDTO[]>();
  for (const s of setlists) {
    const list = map.get(s.month) ?? [];
    list.push(s);
    map.set(s.month, list);
  }
  return Array.from(map.entries());
}

export function SetlistManager() {
  const [setlists, setSetlists] = useState<SetlistDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(null);
  const [confirmDelete, setConfirmDelete] = useState<SetlistDTO | null>(null);
  const [song, setSong] = useState<SongDTO | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { setlists } = await apiFetch<{ setlists: SetlistDTO[] }>('/api/setlists');
      setSetlists(setlists);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function remove() {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await apiFetch(`/api/setlists/${confirmDelete.id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 pt-2">
      <header className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Leader tools</div>
          <h1 className="page-title mt-2">Setlists</h1>
        </div>
        <button type="button" className="btn-primary !px-4 !py-3" onClick={() => setForm({ mode: 'create' })}>
          <Plus width={18} height={18} /> Add
        </button>
      </header>

      {loading ? (
        <SkeletonList>
          <Skeleton className="h-4 w-28" />
          <SetlistSkeleton rows={3} />
        </SkeletonList>
      ) : setlists.length === 0 ? (
        <EmptyState message="No setlists yet. Create one and start adding songs for the month." />
      ) : (
        <div className="space-y-6">
          {groupByMonth(setlists).map(([month, list]) => (
            <section key={month} className="space-y-3">
              <h2 className="eyebrow">{formatMonthLabel(month)}</h2>
              {list.map((s) => {
                return (
                  <section key={s.id} className="animate-rise space-y-3">
                    <div>
                      <h3 className="font-display text-xl font-semibold">
                        {s.name
                          ? s.name
                          : s.events.length
                            ? Array.from(new Set(s.events.map((e) => e.eventName))).join(' · ')
                            : 'Unlinked setlist'}
                      </h3>
                      {s.events.length > 0 && (
                        <p className="text-sm text-ink-faint">
                          {s.events.map((e) => formatEventDate(new Date(e.date))).join(' • ')}
                        </p>
                      )}
                    </div>

                    {s.songs.length > 0 && (
                      <div className="card overflow-hidden">
                        {s.songs.map((song, i) => {
                          const partCount = AUDIO_PARTS.filter((p) => song[p]).length;
                          return (
                            <button
                              key={song.id}
                              type="button"
                              onClick={() => setSong(song)}
                              className="row-press flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left last:border-0"
                            >
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 font-display font-semibold text-accent-ink dark:text-accent-on">
                                {i + 1}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold">{song.songTitle}</span>
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
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button className="btn-ghost !py-2 text-sm" onClick={() => setForm({ mode: 'edit', setlist: s })} type="button">
                        <Pencil width={15} height={15} /> Edit
                      </button>
                      <button className="btn-ghost !py-2 text-sm text-bad" onClick={() => setConfirmDelete(s)} type="button">
                        <Trash width={15} height={15} /> Delete
                      </button>
                    </div>
                  </section>
                );
              })}
            </section>
          ))}
        </div>
      )}

      {form?.mode === 'create' && <SetlistForm mode="create" onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
      {form?.mode === 'edit' && (
        <SetlistForm mode="edit" initial={form.setlist} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />
      )}

      {song && <SongDetail song={song} onClose={() => setSong(null)} />}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete setlist?"
        message="This deletes the setlist, its songs, and all uploaded audio for that month."
        busy={busy}
        onConfirm={remove}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
