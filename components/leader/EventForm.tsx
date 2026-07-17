'use client';

import { useEffect, useRef, useState } from 'react';
import type { EventDTO, RehearsalScheduleItemDTO } from '@/lib/serialize';
import type { SetlistDTO } from '@/lib/setlist-serialize';
import { Overlay } from '@/components/shared/Overlay';
import { TextField, TextArea, SelectField, FieldLabel } from '@/components/shared/Field';
import { Plus, X, ChevronDown, Upload, Book, Shirt, Trash, Calendar, Clock, Music } from '@/components/shared/Icons';
import { AssignmentsSection, toAssignmentMap, type AssignmentMap } from './AssignmentsSection';
import { apiFetch } from '@/lib/api-client';
import { uploadFile } from '@/lib/upload-client';
import { cn, randomToken } from '@/lib/utils';
import { parseCalendarDate, startOfToday } from '@/lib/dates';
import { applyTimeEdit, buildRehearsalPreset, songNameForSlot } from '@/lib/rehearsal-schedule';

const TYPES = [
  { value: 'service', label: 'Service' },
  { value: 'rehearsal', label: 'Rehearsal' },
  { value: 'prayer', label: 'Prayer' },
  { value: 'holy_talks', label: 'Holy Talks' },
  { value: 'other', label: 'Other' },
] as const;

const REPEATS = [
  { value: 'once', label: 'Once' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
] as const;

type FormEvent = Partial<EventDTO>;

/** One attire color: a free-text name plus an exact swatch color via the native picker. */
function AttireColorField({
  label,
  name,
  onName,
  hex,
  onHex,
  placeholder,
}: {
  label: string;
  name: string;
  onName: (v: string) => void;
  hex: string;
  onHex: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          className="field flex-1"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={placeholder}
        />
        <input
          type="color"
          value={hex || '#000000'}
          onChange={(e) => onHex(e.target.value)}
          aria-label={`${label} swatch color`}
          title={hex || 'Pick exact color'}
          className="h-10 w-10 shrink-0 cursor-pointer rounded-xl border border-line bg-surface p-1"
        />
        {hex && (
          <button
            type="button"
            onClick={() => onHex('')}
            aria-label={`Clear ${label} color`}
            className="row-press shrink-0 rounded-lg p-1 text-ink-faint hover:text-ink"
          >
            <X width={16} height={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function toDateInput(iso?: string): string {
  if (!iso) return '';
  // Event dates are UTC-midnight calendar days — read the UTC parts so the
  // <input type="date"> shows the same day regardless of the viewer's timezone.
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** True only for a calendar day strictly after today (UTC) — the preset is
 *  pre-loaded for future rehearsals, never current or past ones. */
function isFutureDate(dateInput: string): boolean {
  if (!dateInput) return false;
  const d = parseCalendarDate(dateInput);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() > startOfToday().getTime();
}

export function EventForm({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  initial?: EventDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [eventName, setEventName] = useState(initial?.eventName ?? '');
  const [type, setType] = useState<FormEvent['type']>(initial?.type ?? 'service');
  const [date, setDate] = useState(toDateInput(initial?.date));
  const [time, setTime] = useState(initial?.time ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [repeats, setRepeats] = useState<FormEvent['repeats']>(initial?.repeats ?? 'once');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  // Holy Talks
  const [topic, setTopic] = useState(initial?.topic ?? '');
  const [scriptures, setScriptures] = useState<string[]>(initial?.scriptures ?? []);
  const [scriptureDraft, setScriptureDraft] = useState('');
  const [holyTalksNotes, setHolyTalksNotes] = useState(initial?.holyTalksNotes ?? '');

  // Rehearsal schedule (rehearsal only) — an ordered run-of-show the leader edits
  // by hand. A saved schedule loads as-is; otherwise a FUTURE rehearsal pre-loads
  // the preset (nothing is persisted until the leader saves the form). Song rows
  // carry a songSlot and resolve their title from the attached setlist below.
  const [schedule, setSchedule] = useState<RehearsalScheduleItemDTO[]>(() => {
    if (initial?.rehearsalSchedule && initial.rehearsalSchedule.length > 0) {
      return initial.rehearsalSchedule;
    }
    const startType = initial?.type ?? 'service';
    return startType === 'rehearsal' && isFutureDate(toDateInput(initial?.date))
      ? buildRehearsalPreset()
      : [];
  });
  // Setlist titles for this event, so song-review rows show the live song names.
  const [setlistTitles, setSetlistTitles] = useState<string[]>([]);
  useEffect(() => {
    if (!initial?.id) return;
    let active = true;
    apiFetch<{ setlists: SetlistDTO[] }>(`/api/setlists?eventId=${initial.id}`)
      .then(({ setlists }) => {
        const sl = setlists.find((s) => s.songs.length > 0) ?? null;
        if (active) setSetlistTitles(sl ? sl.songs.map((s) => s.songTitle) : []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [initial?.id]);

  // Singing assignments (service only)
  const [assignments, setAssignments] = useState<AssignmentMap>(toAssignmentMap(initial?.assignments));

  // Attire
  const [attireOpen, setAttireOpen] = useState(
    Boolean(initial?.attirePrimary || initial?.attireNotes || initial?.attirePhotos?.length),
  );
  const [attirePrimary, setAttirePrimary] = useState(initial?.attirePrimary ?? '');
  const [attirePrimaryHex, setAttirePrimaryHex] = useState(initial?.attirePrimaryHex ?? '');
  const [attireSecondary, setAttireSecondary] = useState(initial?.attireSecondary ?? '');
  const [attireSecondaryHex, setAttireSecondaryHex] = useState(initial?.attireSecondaryHex ?? '');
  const [attireComplement, setAttireComplement] = useState(initial?.attireComplement ?? '');
  const [attireComplementHex, setAttireComplementHex] = useState(initial?.attireComplementHex ?? '');
  const [attireNotes, setAttireNotes] = useState(initial?.attireNotes ?? '');
  const [attirePhotos, setAttirePhotos] = useState<string[]>(initial?.attirePhotos ?? []);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Stable storage folder for this event's attire photos.
  const folderKey = useRef(initial?.id ?? `draft-${randomToken(8)}`);

  const isHolyTalks = type === 'holy_talks';
  // The rehearsal run-of-show only applies to Rehearsal events.
  const isRehearsal = type === 'rehearsal';
  // Attire only applies to Service and Other events.
  const showAttire = type === 'service' || type === 'other';
  // Singing assignments only apply to Service events.
  const showAssignments = type === 'service';

  function addScripture() {
    const s = scriptureDraft.trim();
    if (!s) return;
    setScriptures((prev) => [...prev, s]);
    setScriptureDraft('');
  }

  function addScheduleItem() {
    setSchedule((prev) => [...prev, { time: '', label: '' }]);
  }

  function updateScheduleItem(index: number, patch: Partial<RehearsalScheduleItemDTO>) {
    setSchedule((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeScheduleItem(index: number) {
    setSchedule((prev) => prev.filter((_, i) => i !== index));
  }

  // Editing a row's time cascades the delta to all later rows (earlier ones
  // stay), so extending one block pushes the rest of the evening back.
  function changeScheduleTime(index: number, newTime: string) {
    setSchedule((prev) => applyTimeEdit(prev, index, newTime));
  }

  // Detach a song-review row from the setlist: it becomes a plain, fully-editable
  // line seeded with the currently-resolved song name.
  function unlinkSong(index: number) {
    setSchedule((prev) =>
      prev.map((it, i) => {
        if (i !== index || it.songSlot == null) return it;
        const name = songNameForSlot(it.songSlot, setlistTitles);
        const label = it.label.trim() ? `${it.label.trim()} ${name}` : name;
        return { time: it.time, label };
      }),
    );
  }

  function applyPreset() {
    if (schedule.length > 0 && !window.confirm('Replace the current schedule with the preset?')) return;
    setSchedule(buildRehearsalPreset());
  }

  function clearSchedule() {
    setSchedule([]);
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const path = `attire/${folderKey.current}/${Date.now()}-${file.name}`;
        uploaded.push(await uploadFile(path, file));
      }
      setAttirePhotos((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Photo upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removePhoto(url: string) {
    setAttirePhotos((prev) => prev.filter((u) => u !== url));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!eventName || !date || !time || !location) {
      setError('Name, date, time, and location are required.');
      return;
    }
    setBusy(true);
    const payload = {
      eventName,
      type,
      date,
      time,
      location,
      repeats,
      notes: notes || null,
      attirePrimary: showAttire ? attirePrimary || null : null,
      attirePrimaryHex: showAttire ? attirePrimaryHex || null : null,
      attireSecondary: showAttire ? attireSecondary || null : null,
      attireSecondaryHex: showAttire ? attireSecondaryHex || null : null,
      attireComplement: showAttire ? attireComplement || null : null,
      attireComplementHex: showAttire ? attireComplementHex || null : null,
      attireNotes: showAttire ? attireNotes || null : null,
      attirePhotos: showAttire ? attirePhotos : [],
      topic: isHolyTalks ? topic || null : null,
      scriptures: isHolyTalks ? scriptures : [],
      holyTalksNotes: isHolyTalks ? holyTalksNotes || null : null,
      // Drop fully-empty rows (a leader added a line but left it blank). A song
      // row counts as filled even with a blank descriptor — it resolves to a
      // song name — so keep it as long as it has a slot or a time.
      rehearsalSchedule: isRehearsal
        ? schedule
            .map((s) => ({ time: s.time, label: s.label.trim(), ...(s.songSlot != null ? { songSlot: s.songSlot } : {}) }))
            .filter((s) => s.time || s.label || s.songSlot != null)
        : [],
      assignments: showAssignments
        ? Object.entries(assignments).map(([userId, part]) => ({ userId, part }))
        : [],
    };
    try {
      if (mode === 'create') {
        await apiFetch('/api/events', { method: 'POST', body: JSON.stringify(payload) });
      } else {
        await apiFetch(`/api/events/${initial!.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save event.');
      setBusy(false);
    }
  }

  return (
    <Overlay
      title={mode === 'create' ? 'New event' : 'Edit event'}
      onClose={onClose}
      action={
        <button type="submit" form="event-form" className="btn-primary !px-4 !py-2.5" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <form id="event-form" onSubmit={submit} className="space-y-4">
        <TextField
          label="Event name"
          required
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder="Sunday Service"
          enterKeyHint="next"
        />

        <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value as FormEvent['type'])}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </SelectField>

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 space-y-1.5">
            <FieldLabel>Date</FieldLabel>
            <div className="relative">
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={cn('field min-w-0 pr-11', !date && 'text-transparent')}
              />
              {!date && (
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-faint">mm/dd/yyyy</span>
              )}
              <Calendar width={18} height={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            </div>
          </div>
          <div className="min-w-0 space-y-1.5">
            <FieldLabel>Time</FieldLabel>
            <div className="relative">
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={cn('field min-w-0 pr-11', !time && 'text-transparent')}
              />
              {!time && (
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-faint">9:00 AM</span>
              )}
              <Clock width={18} height={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            </div>
          </div>
        </div>

        <TextField
          label="Location"
          required
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Main sanctuary"
          enterKeyHint="next"
        />

        <SelectField
          label="Repeats"
          value={repeats}
          onChange={(e) => setRepeats(e.target.value as FormEvent['repeats'])}
          disabled={mode === 'edit'}
        >
          {REPEATS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </SelectField>
        {mode === 'create' && repeats !== 'once' && (
          <p className="-mt-2 text-xs text-ink-faint">
            Generates a separate, independently editable event for each occurrence this {repeats === 'monthly' ? 'year' : 'month'}.
          </p>
        )}
        {mode === 'edit' && initial?.repeats !== 'once' && (
          <p className="-mt-2 text-xs text-ink-faint">Editing affects only this occurrence.</p>
        )}

        <TextArea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the team should know" />

        {/* Holy Talks — only when type is holy_talks */}
        {isHolyTalks && (
          <section className="card animate-rise space-y-4 bg-surface-2/40 p-4">
            <p className="eyebrow inline-flex items-center gap-1.5">
              <Book width={14} height={14} /> Holy Talks
            </p>
            <TextField label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Theme of the talk" />
            <div>
              <FieldLabel>Scriptures</FieldLabel>
              <div className="mt-1.5 flex gap-2">
                <input
                  className="field"
                  value={scriptureDraft}
                  onChange={(e) => setScriptureDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addScripture();
                    }
                  }}
                  placeholder="e.g. John 3:16"
                  enterKeyHint="done"
                />
                <button type="button" className="btn-ghost shrink-0" onClick={addScripture}>
                  <Plus width={18} height={18} />
                </button>
              </div>
              {scriptures.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {scriptures.map((s, i) => (
                    <li key={i} className="chip bg-accent/10 text-accent-ink dark:text-accent-on">
                      {s}
                      <button
                        type="button"
                        onClick={() => setScriptures((p) => p.filter((_, j) => j !== i))}
                        aria-label={`Remove ${s}`}
                        className="transition active:scale-90"
                      >
                        <X width={13} height={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <TextArea label="Holy Talks notes" value={holyTalksNotes} onChange={(e) => setHolyTalksNotes(e.target.value)} />
          </section>
        )}

        {/* Rehearsal schedule — only when type is rehearsal. Time on the left
            (edits cascade to later rows), an editable label on the right. Song
            rows fill their name live from the setlist. */}
        {isRehearsal && (
          <section className="card animate-rise space-y-3 bg-surface-2/40 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="eyebrow inline-flex items-center gap-1.5">
                <Clock width={14} height={14} /> Schedule
              </p>
              <p className="text-[11px] text-ink-faint">Editing a time shifts later items too.</p>
            </div>

            {schedule.length === 0 && (
              <p className="rounded-2xl bg-surface px-4 py-3 text-sm text-ink-faint ring-1 ring-inset ring-line">
                No schedule yet. Apply the preset or add items below — nothing shows for the team until you save.
              </p>
            )}

            {schedule.length > 0 && (
              <ul className="space-y-2.5">
                {schedule.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="relative w-28 shrink-0">
                      <input
                        type="time"
                        value={item.time}
                        onChange={(e) => changeScheduleTime(i, e.target.value)}
                        aria-label={`Item ${i + 1} time`}
                        className={cn('field min-w-0 px-3 pr-9', !item.time && 'text-transparent')}
                      />
                      {!item.time && (
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-faint">Time</span>
                      )}
                      <Clock width={16} height={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <input
                        className="field w-full min-w-0"
                        value={item.label}
                        onChange={(e) => updateScheduleItem(i, { label: e.target.value })}
                        placeholder={item.songSlot != null ? 'Song Review:' : 'e.g. Warm-up & vocal run'}
                        aria-label={`Item ${i + 1} label`}
                        enterKeyHint="done"
                      />
                      {item.songSlot != null && (
                        <div className="flex flex-wrap items-center gap-1.5 pl-1">
                          <span className="chip bg-accent/10 text-accent-ink dark:text-accent-on">
                            <Music width={12} height={12} />
                            {songNameForSlot(item.songSlot, setlistTitles)}
                          </span>
                          <span className="text-[11px] text-ink-faint">
                            {setlistTitles.length ? 'auto from setlist' : 'no setlist attached yet'}
                          </span>
                          <button
                            type="button"
                            onClick={() => unlinkSong(i)}
                            className="text-[11px] font-semibold text-ink-faint underline underline-offset-2 transition hover:text-ink"
                          >
                            unlink
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeScheduleItem(i)}
                      aria-label={`Remove item ${i + 1}`}
                      className="row-press mt-1 shrink-0 rounded-lg p-1.5 text-ink-faint hover:text-bad"
                    >
                      <Trash width={16} height={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={addScheduleItem} className="btn-ghost flex-1">
                <Plus width={16} height={16} /> Add item
              </button>
              <button type="button" onClick={applyPreset} className="btn-ghost flex-1">
                Apply preset
              </button>
              {schedule.length > 0 && (
                <button type="button" onClick={clearSchedule} className="btn-ghost flex-1 !text-bad">
                  Clear
                </button>
              )}
            </div>
          </section>
        )}

        {/* Assignments — collapsible; only for Service events */}
        {showAssignments && (
          <AssignmentsSection
            value={assignments}
            onChange={setAssignments}
            initialAssignments={initial?.assignments}
            eventDate={date}
          />
        )}

        {/* Attire — collapsible; only for Service and Other events */}
        {showAttire && (
        <div className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setAttireOpen((o) => !o)}
            className="row-press flex w-full items-center justify-between px-4 py-3.5 text-left"
          >
            <span className="inline-flex items-center gap-2 font-semibold">
              <Shirt width={18} height={18} className="text-accent dark:text-accent-on" /> Attire (optional)
            </span>
            <ChevronDown width={20} height={20} className={cn('text-ink-faint transition', attireOpen && 'rotate-180')} />
          </button>
          {attireOpen && (
            <div className="space-y-4 border-t border-line px-4 py-4">
              <div className="space-y-3">
                <AttireColorField
                  label="Primary"
                  name={attirePrimary}
                  onName={setAttirePrimary}
                  hex={attirePrimaryHex}
                  onHex={setAttirePrimaryHex}
                  placeholder="Black"
                />
                <AttireColorField
                  label="Secondary"
                  name={attireSecondary}
                  onName={setAttireSecondary}
                  hex={attireSecondaryHex}
                  onHex={setAttireSecondaryHex}
                  placeholder="White"
                />
                <AttireColorField
                  label="Tertiary"
                  name={attireComplement}
                  onName={setAttireComplement}
                  hex={attireComplementHex}
                  onHex={setAttireComplementHex}
                  placeholder="Gold"
                />
              </div>
              <TextArea label="Attire notes" value={attireNotes} onChange={(e) => setAttireNotes(e.target.value)} placeholder="Dress shoes, no sneakers" />

              <div>
                <FieldLabel>Photos</FieldLabel>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {attirePhotos.map((url) => (
                    <div key={url} className="relative aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Attire" className="h-full w-full rounded-2xl border border-line object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(url)}
                        className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-bad text-white shadow-card transition active:scale-90"
                        aria-label="Remove photo"
                      >
                        <Trash width={13} height={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="row-press grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-line text-ink-faint"
                  >
                    <span className="flex flex-col items-center gap-1 text-xs font-semibold">
                      <Upload width={20} height={20} />
                      {uploading ? 'Uploading…' : 'Add'}
                    </span>
                  </button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
              </div>
            </div>
          )}
        </div>
        )}

        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Saving…' : mode === 'create' ? 'Create event' : 'Save changes'}
        </button>
      </form>
    </Overlay>
  );
}
