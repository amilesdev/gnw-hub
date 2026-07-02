'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SetlistDTO, SongDTO } from '@/lib/setlist-serialize';
import type { EventDTO } from '@/lib/serialize';
import { Overlay } from '@/components/shared/Overlay';
import { FieldLabel } from '@/components/shared/Field';
import { Plus, Trash, Grip, Check } from '@/components/shared/Icons';
import { SongAudioSlots } from './SongAudioSlots';
import { LyricChartImport } from './LyricChartImport';
import { apiFetch } from '@/lib/api-client';
import { cn, randomToken } from '@/lib/utils';
import { formatEventDate, monthKey } from '@/lib/dates';

type Row = {
  key: string;
  id?: string;
  songTitle: string;
  artist: string;
  youtubeLink: string;
  driveLink: string;
  audio?: Pick<SongDTO, 'audioSoprano' | 'audioAlto' | 'audioTenor' | 'audioAllParts'>;
  lyric?: Pick<SongDTO, 'lyricChart' | 'lyricDocUrl' | 'lyricChartUpdatedAt'>;
};

// Only these event types can carry a setlist — Prayer and Holy Talks never do,
// so they're excluded from the picker.
const SETLIST_EVENT_TYPES = ['service', 'rehearsal', 'other'] as const;

function toRows(setlist?: SetlistDTO): Row[] {
  if (!setlist) return [];
  return setlist.songs.map((s) => ({
    key: s.id,
    id: s.id,
    songTitle: s.songTitle,
    artist: s.artist ?? '',
    youtubeLink: s.youtubeLink ?? '',
    driveLink: s.driveLink ?? '',
    audio: { audioSoprano: s.audioSoprano, audioAlto: s.audioAlto, audioTenor: s.audioTenor, audioAllParts: s.audioAllParts },
    lyric: { lyricChart: s.lyricChart, lyricDocUrl: s.lyricDocUrl, lyricChartUpdatedAt: s.lyricChartUpdatedAt },
  }));
}

export function SetlistForm({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  initial?: SetlistDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(toRows(initial));
  const [name, setName] = useState(initial?.name ?? '');
  const [eventIds, setEventIds] = useState<string[]>(initial?.events.map((e) => e.id) ?? []);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);


  // Pickable events: upcoming ones of a setlist-eligible type, plus any
  // already-linked events (which may be in the past) so they can be unlinked.
  const eventOptions = useMemo(() => {
    const opts = events
      .filter((e) => (SETLIST_EVENT_TYPES as readonly string[]).includes(e.type))
      .map((e) => ({ id: e.id, eventName: e.eventName, date: e.date }));
    for (const ev of initial?.events ?? []) {
      if (!opts.some((o) => o.id === ev.id)) opts.unshift({ id: ev.id, eventName: ev.eventName, date: ev.date });
    }
    return opts;
  }, [events, initial?.events]);

  function toggleEvent(id: string) {
    setEventIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  // Audio storage is grouped by month; derive it from the earliest selected event.
  const selectedTimes = eventOptions.filter((e) => eventIds.includes(e.id)).map((e) => new Date(e.date).getTime());
  const month = selectedTimes.length ? monthKey(new Date(Math.min(...selectedTimes))) : initial?.month ?? monthKey();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  useEffect(() => {
    apiFetch<{ events: EventDTO[] }>('/api/events?scope=all')
      .then(({ events }) => setEvents(events))
      .catch(() => {});
  }, []);

  function addSong() {
    setRows((r) => [...r, { key: `new-${randomToken(6)}`, songTitle: '', artist: '', youtubeLink: '', driveLink: '' }]);
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string) {
    setRows((r) => r.filter((row) => row.key !== key));
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setRows((r) => {
      const from = r.findIndex((x) => x.key === active.id);
      const to = r.findIndex((x) => x.key === over.id);
      return arrayMove(r, from, to);
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const songs = rows
      .filter((r) => r.songTitle.trim())
      .map((r) => ({ id: r.id, songTitle: r.songTitle.trim(), artist: r.artist.trim() || null, youtubeLink: r.youtubeLink || null, driveLink: r.driveLink || null }));

    if (eventIds.length === 0) {
      setError('Pick at least one event for this setlist.');
      return;
    }
    setBusy(true);
    try {
      const setlistName = name.trim() || null;
      if (mode === 'create') {
        await apiFetch('/api/setlists', { method: 'POST', body: JSON.stringify({ name: setlistName, eventIds, songs: songs.map(({ id: _id, ...s }) => s) }) });
      } else {
        await apiFetch(`/api/setlists/${initial!.id}`, { method: 'PATCH', body: JSON.stringify({ name: setlistName, eventIds, songs }) });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save setlist.');
      setBusy(false);
    }
  }

  return (
    <Overlay
      title={mode === 'create' ? 'New setlist' : 'Edit setlist'}
      onClose={onClose}
      action={
        <button type="submit" form="setlist-form" className="btn-primary !px-4 !py-2.5" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <form id="setlist-form" onSubmit={save} className="space-y-5">
        <div>
          <FieldLabel>Setlist name</FieldLabel>
          <input
            className="field mt-1.5"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New setlist"
            maxLength={200}
            enterKeyHint="done"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <FieldLabel>Events</FieldLabel>
            {eventIds.length > 0 && (
              <span className="text-xs font-semibold text-accent-ink dark:text-accent-on">
                {eventIds.length} linked
              </span>
            )}
          </div>
          <p className="mb-2.5 mt-0.5 text-xs text-ink-faint">
            Tap to link one or more events — swipe to see more.
          </p>
          {eventOptions.length === 0 ? (
            <p className="text-sm text-ink-faint">No upcoming events yet. Add an event first.</p>
          ) : (
            <div className="no-scrollbar -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1">
              {eventOptions.map((ev) => {
                const on = eventIds.includes(ev.id);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => toggleEvent(ev.id)}
                    aria-pressed={on}
                    className={cn(
                      'row-press relative flex w-36 shrink-0 snap-start flex-col justify-between rounded-2xl border px-3.5 py-3 text-left transition',
                      on ? 'border-accent bg-accent/10 shadow-pop' : 'border-line bg-surface',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-5 w-5 place-items-center rounded-md',
                        on ? 'bg-accent text-white' : 'border border-line',
                      )}
                    >
                      {on && <Check width={13} height={13} />}
                    </span>
                    <span className="mt-2 block truncate text-sm font-semibold">{ev.eventName}</span>
                    <span className="text-xs text-ink-faint">{formatEventDate(new Date(ev.date))}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <FieldLabel>Songs (drag to reorder)</FieldLabel>
            <button type="button" className="btn-ghost !px-3 !py-1.5 text-sm" onClick={addSong}>
              <Plus width={15} height={15} /> Add song
            </button>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-faint">No songs yet. Add the first one.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {rows.map((row, i) => (
                    <SortableSong
                      key={row.key}
                      row={row}
                      index={i}
                      month={month}
                      canEditAudio={mode === 'edit' && !!row.id}
                      onUpdate={(patch) => updateRow(row.key, patch)}
                      onRemove={() => removeRow(row.key)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Saving…' : mode === 'create' ? 'Create setlist' : 'Save changes'}
        </button>
      </form>
    </Overlay>
  );
}

function SortableSong({
  row,
  index,
  month,
  canEditAudio,
  onUpdate,
  onRemove,
}: {
  row: Row;
  index: number;
  month: string;
  canEditAudio: boolean;
  onUpdate: (patch: Partial<Row>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.key });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };

  const songForEdit: SongDTO | null = canEditAudio && row.id
    ? {
        id: row.id,
        position: index,
        songTitle: row.songTitle,
        artist: row.artist || null,
        youtubeLink: row.youtubeLink || null,
        driveLink: row.driveLink || null,
        audioSoprano: row.audio?.audioSoprano ?? null,
        audioAlto: row.audio?.audioAlto ?? null,
        audioTenor: row.audio?.audioTenor ?? null,
        audioAllParts: row.audio?.audioAllParts ?? null,
        lyricChart: row.lyric?.lyricChart ?? null,
        lyricDocUrl: row.lyric?.lyricDocUrl ?? null,
        lyricChartUpdatedAt: row.lyric?.lyricChartUpdatedAt ?? null,
      }
    : null;

  return (
    <div ref={setNodeRef} style={style} className="card space-y-3 p-3">
      <div className="flex items-center gap-2">
        <button type="button" className="cursor-grab touch-none text-ink-faint active:cursor-grabbing" {...attributes} {...listeners} aria-label="Drag to reorder">
          <Grip width={20} height={20} />
        </button>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/10 text-sm font-bold text-accent-ink dark:text-accent-on">{index + 1}</span>
        <input
          className="field !py-2.5"
          value={row.songTitle}
          onChange={(e) => onUpdate({ songTitle: e.target.value })}
          placeholder="Song title"
          enterKeyHint="next"
        />
        <button type="button" className="row-press rounded-lg p-1 text-bad" onClick={onRemove} aria-label="Remove song">
          <Trash width={18} height={18} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 pl-9">
        <input className="field !py-2.5 text-sm" value={row.artist} onChange={(e) => onUpdate({ artist: e.target.value })} placeholder="Artist" enterKeyHint="next" />
        <input
          className="field !py-2.5 text-sm"
          value={row.youtubeLink}
          onChange={(e) => onUpdate({ youtubeLink: e.target.value })}
          placeholder="YouTube link"
          inputMode="url"
          enterKeyHint="next"
        />
        <input
          className="field !py-2.5 text-sm"
          value={row.driveLink}
          onChange={(e) => onUpdate({ driveLink: e.target.value })}
          placeholder="Drive link (optional)"
          inputMode="url"
          enterKeyHint="done"
        />
      </div>
      {songForEdit && (
        <div className="space-y-3 pl-9">
          <SongAudioSlots song={songForEdit} month={month} onChanged={(s) => onUpdate({ audio: { audioSoprano: s.audioSoprano, audioAlto: s.audioAlto, audioTenor: s.audioTenor, audioAllParts: s.audioAllParts } })} />
          <LyricChartImport song={songForEdit} onChanged={(s) => onUpdate({ lyric: { lyricChart: s.lyricChart, lyricDocUrl: s.lyricDocUrl, lyricChartUpdatedAt: s.lyricChartUpdatedAt } })} />
        </div>
      )}
    </div>
  );
}
