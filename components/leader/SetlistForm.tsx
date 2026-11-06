'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { SetlistDTO, SongDTO, LibrarySongDTO, LeadDTO } from '@/lib/setlist-serialize';
import type { EventDTO } from '@/lib/serialize';
import { Overlay } from '@/components/shared/Overlay';
import { FieldLabel, TextField } from '@/components/shared/Field';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/shared/Toast';
import { Plus, Trash, Grip, Check, Book } from '@/components/shared/Icons';
import { SongAudioSlots } from './SongAudioSlots';
import { SongBandFields } from './SongBandFields';
import { LyricChartImport } from '@/components/shared/LyricChartImport';
import { LibraryPicker } from './LibraryPicker';
import { SongLeadPicker, leadCandidates } from './SongLeadPicker';
import type { MemberRow } from './MembersManager';
import { apiFetch } from '@/lib/api-client';
import { cn, randomToken } from '@/lib/utils';
import { formatEventDate, monthKey } from '@/lib/dates';
import { SETLIST_EVENT_TYPES } from '@/lib/event-types';

type Row = {
  key: string;
  id?: string;
  songTitle: string;
  artist: string;
  youtubeLink: string;
  // Who leads this song on this setlist. Full LeadDTOs (not just ids) so the
  // picker can show faces without a lookup; only the ids are sent on save.
  leads: LeadDTO[];
  audio?: Pick<SongDTO, 'audioSoprano' | 'audioAlto' | 'audioTenor' | 'audioAllParts'>;
  lyric?: Pick<SongDTO, 'lyricChart' | 'lyricDocUrl' | 'lyricChartUpdatedAt'>;
  arrangementAudio?: string | null;
  songKey?: string | null;
  bpm?: string | null;
};

function toRows(setlist?: SetlistDTO): Row[] {
  if (!setlist) return [];
  return setlist.songs.map((s) => ({
    key: s.id,
    id: s.id,
    songTitle: s.songTitle,
    artist: s.artist ?? '',
    youtubeLink: s.youtubeLink ?? '',
    leads: s.leads,
    audio: { audioSoprano: s.audioSoprano, audioAlto: s.audioAlto, audioTenor: s.audioTenor, audioAllParts: s.audioAllParts },
    lyric: { lyricChart: s.lyricChart, lyricDocUrl: s.lyricDocUrl, lyricChartUpdatedAt: s.lyricChartUpdatedAt },
    arrangementAudio: s.arrangementAudio,
    songKey: s.songKey,
    bpm: s.bpm,
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
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const toast = useToast();

  // What the form looked like when it opened, so closing with edits asks first.
  // Uploads inside a row save on their own, so only what Save sends counts.
  const snapshot = () =>
    JSON.stringify({
      name: name.trim(),
      eventIds: [...eventIds].sort(),
      rows: rows.map((r) => [r.id ?? r.key, r.songTitle, r.artist, r.youtubeLink, r.leads.map((l) => l.id)]),
    });
  const initialSnapshot = useRef<string | null>(null);
  if (initialSnapshot.current === null) initialSnapshot.current = snapshot();
  const dirty = () => !busy && snapshot() !== initialSnapshot.current;

  // Library songs already in this setlist — hidden from the picker so the same
  // song can't be added twice.
  const usedSongIds = useMemo(() => new Set(rows.map((r) => r.id).filter((id): id is string => !!id)), [rows]);

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
    // Fetched once for the whole form; every song's lead picker shares the list.
    apiFetch<{ members: MemberRow[] }>('/api/members')
      .then(({ members }) => setMembers(members))
      .catch(() => {});
  }, []);

  const candidates = useMemo(() => leadCandidates(members), [members]);

  function addSong() {
    setRows((r) => [...r, { key: `new-${randomToken(6)}`, songTitle: '', artist: '', youtubeLink: '', leads: [] }]);
  }

  // Append library songs as reference rows — they carry the library `id`, so
  // saving links the existing entry (with its parts/chart) rather than copying.
  // Leads start at whoever led the song last: a suggestion the leader can keep
  // or change, since the same people usually carry a song week to week.
  function addFromLibrary(songs: LibrarySongDTO[]) {
    setRows((r) => [
      ...r,
      ...songs.map((s) => ({
        key: `lib-${s.id}`,
        id: s.id,
        songTitle: s.songTitle,
        artist: s.artist ?? '',
        youtubeLink: s.youtubeLink ?? '',
        leads: s.lastLeads,
        audio: { audioSoprano: s.audioSoprano, audioAlto: s.audioAlto, audioTenor: s.audioTenor, audioAllParts: s.audioAllParts },
        lyric: { lyricChart: s.lyricChart, lyricDocUrl: s.lyricDocUrl, lyricChartUpdatedAt: s.lyricChartUpdatedAt },
        arrangementAudio: s.arrangementAudio,
        songKey: s.songKey,
        bpm: s.bpm,
      })),
    ]);
    setShowLibrary(false);
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  // Removing a row is quick to undo (CMP-22) rather than confirmed; nothing is
  // saved until Save anyway.
  function removeRow(key: string) {
    const index = rows.findIndex((row) => row.key === key);
    const removed = rows[index];
    if (!removed) return;
    setRows((r) => r.filter((row) => row.key !== key));
    toast.show({
      message: `Removed “${removed.songTitle.trim() || 'Untitled'}”.`,
      undo: () =>
        setRows((r) => (r.some((row) => row.key === key) ? r : [...r.slice(0, index), removed, ...r.slice(index)])),
    });
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
    // `leadUserIds` is always sent — the form holds the whole picture, so an
    // empty list means "nobody leads this", not "leave it alone".
    const songs = rows
      .filter((r) => r.songTitle.trim())
      .map((r) => ({
        id: r.id,
        songTitle: r.songTitle.trim(),
        artist: r.artist.trim() || null,
        youtubeLink: r.youtubeLink || null,
        leadUserIds: r.leads.map((l) => l.id),
      }));

    if (eventIds.length === 0) {
      setError('Pick at least one event for this setlist.');
      return;
    }
    setBusy(true);
    try {
      const setlistName = name.trim() || null;
      if (mode === 'create') {
        // Send ids too: a library-picked song carries its id so the API links the
        // existing library entry instead of duplicating it.
        await apiFetch('/api/setlists', { method: 'POST', body: JSON.stringify({ name: setlistName, eventIds, songs }) });
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
      backLabel="Setlists"
      canClose={() => {
        if (!dirty()) return true;
        setConfirmDiscard(true);
        return false;
      }}
      action={
        <button type="submit" form="setlist-form" className="btn-primary btn-sm h-11 min-w-[76px]" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <form id="setlist-form" onSubmit={save} className="space-y-6">
        <TextField
          label="Setlist name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New setlist"
          maxLength={200}
          enterKeyHint="done"
        />

        <div>
          <div className="flex items-baseline justify-between">
            <FieldLabel>Events</FieldLabel>
            {eventIds.length > 0 && (
              <span className="text-xs font-semibold text-accent-ink">
                {eventIds.length} linked
              </span>
            )}
          </div>
          <p className="mb-2.5 mt-1 text-[13px] leading-[18px] text-ink-faint">
            Tap to link one or more events. Swipe to see more.
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
                      'relative flex w-36 shrink-0 snap-start flex-col justify-between rounded-[18px] px-3.5 py-3 text-left transition duration-150 active:scale-[0.97]',
                      on ? 'border-[1.5px] border-accent bg-accent/10' : 'border border-line bg-surface',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-5 w-5 place-items-center rounded-md',
                        on ? 'bg-accent text-accent-fg' : 'border border-line',
                      )}
                    >
                      {on && <Check width={13} height={13} />}
                    </span>
                    <span className="mt-2 block truncate text-sm font-semibold">{ev.eventName}</span>
                    <span className="text-[13px] text-ink-faint">{formatEventDate(new Date(ev.date))}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <FieldLabel>Songs (drag to reorder)</FieldLabel>
            <div className="flex shrink-0 gap-2">
              <button type="button" className="btn-ghost btn-sm" onClick={() => setShowLibrary(true)}>
                <Book width={16} height={16} /> Library
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={addSong}>
                <Plus width={16} height={16} /> New
              </button>
            </div>
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
                      candidates={candidates}
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

        {error && <p role="alert" className="text-[13px] font-semibold text-bad-ink">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Saving…' : mode === 'create' ? 'Create setlist' : 'Save changes'}
        </button>
      </form>

      {showLibrary && (
        <LibraryPicker excludeIds={usedSongIds} onAdd={addFromLibrary} onClose={() => setShowLibrary(false)} />
      )}

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard changes?"
        message="Your edits to this setlist won’t be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        onClose={() => setConfirmDiscard(false)}
      />
    </Overlay>
  );
}

function SortableSong({
  row,
  index,
  month,
  candidates,
  canEditAudio,
  onUpdate,
  onRemove,
}: {
  row: Row;
  index: number;
  month: string;
  candidates: LeadDTO[];
  canEditAudio: boolean;
  onUpdate: (patch: Partial<Row>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.key });
  const style = { transform: CSS.Transform.toString(transform), transition };

  // Shaped for the audio/lyric/band editors, which key off the library song id.
  const songForEdit: SongDTO | null = canEditAudio && row.id
    ? {
        id: row.id,
        position: index,
        leads: row.leads,
        songTitle: row.songTitle,
        artist: row.artist || null,
        youtubeLink: row.youtubeLink || null,
        audioSoprano: row.audio?.audioSoprano ?? null,
        audioAlto: row.audio?.audioAlto ?? null,
        audioTenor: row.audio?.audioTenor ?? null,
        audioAllParts: row.audio?.audioAllParts ?? null,
        arrangementAudio: row.arrangementAudio ?? null,
        songKey: row.songKey ?? null,
        bpm: row.bpm ?? null,
        lyricChart: row.lyric?.lyricChart ?? null,
        lyricDocUrl: row.lyric?.lyricDocUrl ?? null,
        lyricChartUpdatedAt: row.lyric?.lyricChartUpdatedAt ?? null,
      }
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'card space-y-3 p-3 transition-[box-shadow,scale] duration-150',
        // The lifted card while dragging (SG-7).
        isDragging && 'relative z-10 scale-[1.02] shadow-card-lg',
      )}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="-ml-2 grid h-11 w-9 shrink-0 cursor-grab touch-none place-items-center text-ink-faint active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <Grip width={20} height={20} />
        </button>
        <span className="numeral-sm w-6 shrink-0 text-center text-accent-ink">{index + 1}</span>
        <input
          className="field ml-1 h-11 py-0"
          value={row.songTitle}
          onChange={(e) => onUpdate({ songTitle: e.target.value })}
          placeholder="Song title"
          aria-label="Song title"
          enterKeyHint="next"
        />
        <button type="button" className="btn-icon -mr-1.5 text-bad-ink" onClick={onRemove} aria-label="Remove song">
          <Trash width={18} height={18} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 pl-[60px]">
        <input
          className="field h-11 py-0"
          value={row.artist}
          onChange={(e) => onUpdate({ artist: e.target.value })}
          placeholder="Artist"
          aria-label="Artist"
          enterKeyHint="next"
        />
        <input
          className="field h-11 py-0"
          value={row.youtubeLink}
          onChange={(e) => onUpdate({ youtubeLink: e.target.value })}
          placeholder="YouTube link"
          aria-label="YouTube link"
          inputMode="url"
          enterKeyHint="done"
        />
        <SongLeadPicker value={row.leads} candidates={candidates} onChange={(leads) => onUpdate({ leads })} />
      </div>
      {!songForEdit && (
        <p className="pl-[60px] text-[13px] leading-[18px] text-ink-faint">
          Parts, key and lyrics can be added after you save.
        </p>
      )}
      {songForEdit && (
        <div className="space-y-3">
          {/* Key/BPM + arrangement sit right after the YouTube link. */}
          <SongBandFields
            song={songForEdit}
            onChanged={(s) => onUpdate({ songKey: s.songKey, bpm: s.bpm, arrangementAudio: s.arrangementAudio })}
          />
          <SongAudioSlots song={songForEdit} month={month} onChanged={(s) => onUpdate({ audio: { audioSoprano: s.audioSoprano, audioAlto: s.audioAlto, audioTenor: s.audioTenor, audioAllParts: s.audioAllParts } })} />
          <LyricChartImport song={songForEdit} onChanged={(s) => onUpdate({ lyric: { lyricChart: s.lyricChart, lyricDocUrl: s.lyricDocUrl, lyricChartUpdatedAt: s.lyricChartUpdatedAt } })} />
        </div>
      )}
    </div>
  );
}
