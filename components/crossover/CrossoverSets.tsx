'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import type { CrossoverSetDTO } from '@/lib/crossover-sets';
import type { LibrarySongDTO, SongDTO } from '@/lib/setlist-serialize';
import { totalMinutes } from '@/lib/crossover-season';
import { Overlay } from '@/components/shared/Overlay';
import { FieldLabel } from '@/components/shared/Field';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { SongDetail } from '@/components/shared/SongDetail';
import { ChevronDown, Clock, Music, Pencil, Plus, Trash, X } from '@/components/shared/Icons';
import { AssignmentsSection, VOCAL_PARTS, type AssignmentMap } from '@/components/leader/AssignmentsSection';
import { LibraryPicker } from '@/components/leader/LibraryPicker';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type Base = '/home' | '/dashboard';

/**
 * Crossover sets: the season's setlist as named sets in running order, each
 * with its songs (from the Crossover song list) and its singers by part.
 * Everyone can open a song for its parts and lyrics; leaders add, edit,
 * reorder and remove sets.
 */
export function CrossoverSets({
  base,
  year,
  initialSets,
  canManage,
}: {
  base: Base;
  year: number;
  initialSets: CrossoverSetDTO[];
  canManage: boolean;
}) {
  const [sets, setSets] = useState(initialSets);
  const [song, setSong] = useState<SongDTO | null>(null);
  const [editing, setEditing] = useState<CrossoverSetDTO | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CrossoverSetDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = totalMinutes(sets);
  const songCount = sets.reduce((n, s) => n + s.songs.length, 0);

  async function move(index: number, by: -1 | 1) {
    const order = sets.map((s) => s.id);
    const [moved] = order.splice(index, 1);
    order.splice(index + by, 0, moved);
    setError(null);
    try {
      const res = await apiFetch<{ sets: CrossoverSetDTO[] }>('/api/crossover/sets', {
        method: 'PATCH',
        body: JSON.stringify({ order }),
      });
      setSets(res.sets);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reorder the sets.');
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ sets: CrossoverSetDTO[] }>(`/api/crossover/sets/${deleting.id}`, {
        method: 'DELETE',
      });
      setSets(res.sets);
      setDeleting(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the set.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 pt-2">
      <ScreenHeader
        back={{ href: `${base}/crossover`, label: 'Crossover' }}
        eyebrow={`Crossover ${year}`}
        title="Sets"
        className="mb-0"
        actions={
          <>
            {canManage && (
              <div className="flex items-center gap-2">
                <Link href="/dashboard/crossover/songs" className="btn-outline btn-sm h-11 max-[389px]:!px-3">
                  <Music width={18} height={18} /> <span className="max-[389px]:sr-only">Songs</span>
                </Link>
                <button type="button" className="btn-primary btn-sm h-11" onClick={() => setEditing('new')}>
                  <Plus width={18} height={18} /> Set
                </button>
              </div>
            )}
          </>
        }
      />
      <p className="-mt-2 text-sm text-ink-soft">
        {sets.length} set{sets.length === 1 ? '' : 's'} · {songCount} song{songCount === 1 ? '' : 's'}
        {total > 0 && ` · ${total} min planned`}
      </p>
      {error && <p className="text-sm font-semibold text-bad-ink">{error}</p>}

      {sets.length === 0 ? (
        <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-faint">
          No sets yet.{canManage ? ' Add the first one.' : ''}
        </p>
      ) : (
        <div className="space-y-3">
          {sets.map((set, i) => (
            <SetCard
              key={set.id}
              set={set}
              index={i}
              onSong={setSong}
              manage={
                canManage
                  ? {
                      onEdit: () => setEditing(set),
                      onDelete: () => setDeleting(set),
                      onUp: i > 0 ? () => move(i, -1) : undefined,
                      onDown: i < sets.length - 1 ? () => move(i, 1) : undefined,
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {song && <SongDetail song={song} onClose={() => setSong(null)} />}

      {editing && (
        <SetEditor
          initial={editing === 'new' ? null : editing}
          crossoverDate={`${year}-12-31`}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            setSets(next);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete this set?"
        message="Its songs stay in the Crossover song list; only the set and its singers are removed."
        confirmLabel="Delete"
        busy={busy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function SetCard({
  set,
  index,
  onSong,
  manage,
}: {
  set: CrossoverSetDTO;
  index: number;
  onSong: (song: SongDTO) => void;
  manage?: { onEdit: () => void; onDelete: () => void; onUp?: () => void; onDown?: () => void };
}) {
  const byPart = VOCAL_PARTS.map((part) => ({
    part,
    names: set.singers.filter((s) => s.part === part).map((s) => s.name),
  })).filter((g) => g.names.length);

  return (
    <section className="card animate-rise p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-crossover-ever text-[13px] font-bold text-crossover-gold-hi">
            {index + 1}
          </span>
          <h2 className="truncate font-display text-xl font-semibold">{set.name}</h2>
        </div>
        {set.minutes != null && (
          <span className="chip shrink-0 bg-surface-2 text-ink-soft">
            <Clock width={13} height={13} /> {set.minutes} min
          </span>
        )}
      </div>

      {set.songs.length > 0 ? (
        // lines only between songs; the Edit row below brings its own top line
        <ol className="mt-3 divide-y divide-line border-t border-line">
          {set.songs.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSong(s)}
                className="row-press flex w-full items-center gap-3 py-2.5 text-left"
              >
                <span className="w-4 shrink-0 text-xs font-bold text-ink-faint tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{s.songTitle}</span>
                  {s.artist && <span className="block truncate text-xs text-ink-faint">{s.artist}</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-ink-faint">No songs yet.</p>
      )}

      {byPart.length > 0 && (
        <div className="mt-3 space-y-1">
          {byPart.map(({ part, names }) => (
            <div key={part} className="flex items-center gap-2 text-xs">
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-accent/10 text-[10px] font-bold text-accent-ink">
                {part[0]}
              </span>
              <span className="text-ink-soft">{names.join(', ')}</span>
            </div>
          ))}
        </div>
      )}

      {manage && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          <button type="button" className="btn-ghost btn-sm" onClick={manage.onEdit}>
            <Pencil width={15} height={15} /> Edit
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm disabled:opacity-30"
            onClick={manage.onUp}
            disabled={!manage.onUp}
            aria-label={`Move ${set.name} up`}
          >
            <ChevronDown width={16} height={16} className="rotate-180" />
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm disabled:opacity-30"
            onClick={manage.onDown}
            disabled={!manage.onDown}
            aria-label={`Move ${set.name} down`}
          >
            <ChevronDown width={16} height={16} />
          </button>
          <button type="button" className="btn-ghost btn-sm ml-auto text-bad-ink" onClick={manage.onDelete}>
            <Trash width={15} height={15} /> Delete
          </button>
        </div>
      )}
    </section>
  );
}

type EditorSong = { id: string; songTitle: string; artist: string | null };

/** Add or edit one set: its name, planned length, songs (in order) and singers. */
function SetEditor({
  initial,
  crossoverDate,
  onClose,
  onSaved,
}: {
  initial: CrossoverSetDTO | null;
  crossoverDate: string;
  onClose: () => void;
  onSaved: (sets: CrossoverSetDTO[]) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [minutes, setMinutes] = useState(initial?.minutes != null ? String(initial.minutes) : '');
  const [songs, setSongs] = useState<EditorSong[]>(initial?.songs ?? []);
  const [singers, setSingers] = useState<AssignmentMap>(() =>
    Object.fromEntries((initial?.singers ?? []).map((s) => [s.userId, s.part])),
  );
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function moveSong(i: number, by: -1 | 1) {
    setSongs((prev) => {
      const next = [...prev];
      const [s] = next.splice(i, 1);
      next.splice(i + by, 0, s);
      return next;
    });
  }

  async function save() {
    if (!name.trim()) {
      setError('Give the set a name.');
      return;
    }
    const mins = minutes.trim() === '' ? null : Number(minutes);
    if (mins != null && (!Number.isInteger(mins) || mins < 0)) {
      setError('Minutes should be a whole number.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let id = initial?.id;
      if (!id) {
        const created = await apiFetch<{ sets: CrossoverSetDTO[] }>('/api/crossover/sets', {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), minutes: mins }),
        });
        id = created.sets[created.sets.length - 1]?.id;
      }
      const res = await apiFetch<{ sets: CrossoverSetDTO[] }>(`/api/crossover/sets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          minutes: mins,
          songIds: songs.map((s) => s.id),
          singers: Object.entries(singers).map(([userId, part]) => ({ userId, part })),
        }),
      });
      onSaved(res.sets);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the set.');
      setBusy(false);
    }
  }

  return (
    <Overlay
      title={initial ? `Edit ${initial.name}` : 'New set'}
      onClose={onClose}
      action={
        <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-[1fr_6.5rem] gap-3">
          <div className="min-w-0">
            <FieldLabel>Name</FieldLabel>
            <input
              className="field mt-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Set 3"
              enterKeyHint="next"
            />
          </div>
          <div className="min-w-0">
            <FieldLabel>Minutes</FieldLabel>
            <input
              className="field mt-1.5"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="8"
              inputMode="numeric"
              enterKeyHint="done"
            />
          </div>
        </div>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <FieldLabel>Songs</FieldLabel>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setPicking(true)}>
              <Plus width={15} height={15} /> Add songs
            </button>
          </div>
          {songs.length === 0 ? (
            <p className="rounded-2xl bg-surface-2 px-4 py-4 text-center text-sm text-ink-faint">
              No songs yet. Add them from the Crossover song list.
            </p>
          ) : (
            <ol className="card overflow-hidden">
              {songs.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2 border-b border-line px-3 py-2.5 last:border-0">
                  <span className="w-4 shrink-0 text-xs font-bold text-ink-faint tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{s.songTitle}</span>
                    {s.artist && <span className="block truncate text-xs text-ink-faint">{s.artist}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => moveSong(i, -1)}
                    disabled={i === 0}
                    className="row-press grid h-8 w-8 place-items-center rounded-lg text-ink-soft disabled:opacity-30"
                    aria-label={`Move ${s.songTitle} up`}
                  >
                    <ChevronDown width={16} height={16} className="rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSong(i, 1)}
                    disabled={i === songs.length - 1}
                    className="row-press grid h-8 w-8 place-items-center rounded-lg text-ink-soft disabled:opacity-30"
                    aria-label={`Move ${s.songTitle} down`}
                  >
                    <ChevronDown width={16} height={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSongs((prev) => prev.filter((x) => x.id !== s.id))}
                    className={cn(
                      'row-press grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:text-bad-ink',
                    )}
                    aria-label={`Remove ${s.songTitle}`}
                  >
                    <X width={16} height={16} />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <AssignmentsSection
          title="Singers"
          value={singers}
          onChange={setSingers}
          initialAssignments={initial?.singers.map((s) => ({ userId: s.userId, name: s.name, part: s.part }))}
          eventDate={crossoverDate}
        />

        {error && <p className="text-sm font-semibold text-bad-ink">{error}</p>}
      </div>

      {picking && (
        <LibraryPicker
          scope="crossover"
          title="Add Crossover songs"
          excludeIds={new Set(songs.map((s) => s.id))}
          onAdd={(picked: LibrarySongDTO[]) => {
            setSongs((prev) => [
              ...prev,
              ...picked.map((p) => ({ id: p.id, songTitle: p.songTitle, artist: p.artist })),
            ]);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </Overlay>
  );
}
