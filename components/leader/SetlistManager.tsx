'use client';

import { useEffect, useState } from 'react';
import type { SetlistDTO, SongDTO } from '@/lib/setlist-serialize';
import type { SongSheetContext } from '@/components/shared/AudioProvider';
import { SetlistForm } from './SetlistForm';
import { SongDetail } from '@/components/shared/SongDetail';
import { SetlistHeading, SetlistSongs } from '@/components/shared/SetlistScreen';
import { setlistTitle } from '@/lib/setlist-title';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton, SetlistSkeleton, SkeletonList } from '@/components/shared/Skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ActionSheet } from '@/components/shared/ActionSheet';
import { MoreHorizontal, Pencil } from '@/components/shared/Icons';
import { apiFetch } from '@/lib/api-client';
import { useDataChanged } from '@/lib/data-changed';
import { formatEventDate } from '@/lib/dates';

type FormState = { mode: 'create' } | { mode: 'edit'; setlist: SetlistDTO } | null;

/**
 * Songs › Setlists for leaders (SG-2). The Songs tab supplies the header and
 * its "Add" button (`creating`). Edit/Delete live behind each setlist's More
 * menu. A reload after a save keeps the list on screen with a thin progress
 * bar instead of swapping back to a skeleton.
 */
export function SetlistManager({
  creating = false,
  onCreatingChange,
}: {
  creating?: boolean;
  onCreatingChange?: (v: boolean) => void;
}) {
  const [setlists, setSetlists] = useState<SetlistDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [form, setForm] = useState<FormState>(null);
  const [more, setMore] = useState<SetlistDTO | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SetlistDTO | null>(null);
  const [open, setOpen] = useState<{ song: SongDTO; context: SongSheetContext } | null>(null);
  const [busy, setBusy] = useState(false);

  /** After the first load, reloads keep what's on screen (no skeleton flash). */
  async function load() {
    setReloading(true);
    try {
      const { setlists } = await apiFetch<{ setlists: SetlistDTO[] }>('/api/setlists');
      setSetlists(setlists);
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (creating) setForm({ mode: 'create' });
  }, [creating]);

  // A save elsewhere (vocal parts from a song card, song leads…) or a newer copy.
  useDataChanged(() => {
    load().catch(() => {});
  });

  function closeForm() {
    setForm(null);
    onCreatingChange?.(false);
  }

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
    <>
      {reloading && !loading && (
        <div className="-mt-4 mb-4 h-0.5 overflow-hidden rounded-full bg-track" role="status" aria-label="Refreshing">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
        </div>
      )}

      {loading ? (
        <SkeletonList>
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3.5 w-24" />
          <SetlistSkeleton rows={3} />
        </SkeletonList>
      ) : setlists.length === 0 ? (
        <EmptyState message="No setlists yet. Create one and start adding songs for the month." />
      ) : (
        <div className="space-y-6">
          {setlists.map((s) => (
            <section key={s.id} className="animate-rise space-y-3">
              <SetlistHeading
                setlist={s}
                action={
                  <button
                    type="button"
                    onClick={() => setMore(s)}
                    className="btn-icon -mr-2 -mt-1.5"
                    aria-label={`More for ${setlistTitle(s, 'Unlinked setlist')}`}
                  >
                    <MoreHorizontal width={20} height={20} />
                  </button>
                }
              />
              {s.songs.length > 0 && (
                <SetlistSongs setlist={s} onSong={(song, context) => setOpen({ song, context })} />
              )}
            </section>
          ))}
        </div>
      )}

      <ActionSheet
        open={!!more}
        onClose={() => setMore(null)}
        title={more ? setlistTitle(more, 'Unlinked setlist') : ''}
        subtitle={more?.events.map((e) => formatEventDate(new Date(e.date))).join(' · ') || undefined}
        actions={
          more
            ? [
                { label: 'Edit setlist', icon: Pencil, onSelect: () => setForm({ mode: 'edit', setlist: more }) },
                { label: 'Delete setlist', tone: 'danger', onSelect: () => setConfirmDelete(more) },
              ]
            : []
        }
      />

      {form?.mode === 'create' && <SetlistForm mode="create" onClose={closeForm} onSaved={() => { closeForm(); load(); }} />}
      {form?.mode === 'edit' && (
        <SetlistForm mode="edit" initial={form.setlist} onClose={closeForm} onSaved={() => { closeForm(); load(); }} />
      )}

      {open && <SongDetail song={open.song} context={open.context} onClose={() => setOpen(null)} />}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete setlist?"
        message="This removes the setlist and its song order. The songs themselves stay in your library — their parts and charts aren't deleted."
        busy={busy}
        onConfirm={remove}
        onClose={() => setConfirmDelete(null)}
      />
    </>
  );
}
