'use client';

import { useEffect, useState } from 'react';
import type { SetlistDTO } from '@/lib/setlist-serialize';
import { AUDIO_PARTS } from '@/lib/setlist-serialize';
import { SetlistForm } from './SetlistForm';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Plus, Pencil, Trash, Music } from '@/components/shared/Icons';
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
        <div className="h-2 w-24 animate-breathe rounded-full bg-accent/30" />
      ) : setlists.length === 0 ? (
        <EmptyState message="No setlists yet. Create one and start adding songs for the month." />
      ) : (
        <div className="space-y-6">
          {groupByMonth(setlists).map(([month, list]) => (
            <section key={month} className="space-y-3">
              <h2 className="eyebrow">{formatMonthLabel(month)}</h2>
              {list.map((s) => {
                const audioCount = s.songs.reduce((n, song) => n + AUDIO_PARTS.filter((p) => song[p]).length, 0);
                return (
                  <div key={s.id} className="card animate-rise p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-display text-xl font-semibold">
                          {s.events.length
                            ? Array.from(new Set(s.events.map((e) => e.eventName))).join(' · ')
                            : 'Unlinked setlist'}
                        </h3>
                        {s.events.length > 0 && (
                          <p className="mt-0.5 text-sm text-ink-soft">
                            {s.events.map((e) => formatEventDate(new Date(e.date))).join(' • ')}
                          </p>
                        )}
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
                          <Music width={14} height={14} /> {s.songs.length} song{s.songs.length === 1 ? '' : 's'} · {audioCount} audio file{audioCount === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="btn-ghost !py-2 text-sm" onClick={() => setForm({ mode: 'edit', setlist: s })} type="button">
                        <Pencil width={15} height={15} /> Edit
                      </button>
                      <button className="btn-ghost !py-2 text-sm text-bad" onClick={() => setConfirmDelete(s)} type="button">
                        <Trash width={15} height={15} /> Delete
                      </button>
                    </div>
                  </div>
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
