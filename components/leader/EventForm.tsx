'use client';

import { useRef, useState } from 'react';
import type { EventDTO } from '@/lib/serialize';
import { Overlay } from '@/components/shared/Overlay';
import { TextField, TextArea, SelectField, FieldLabel } from '@/components/shared/Field';
import { Plus, X, ChevronDown, Upload, Book, Shirt, Trash, Calendar, Clock } from '@/components/shared/Icons';
import { apiFetch } from '@/lib/api-client';
import { uploadFile } from '@/lib/upload-client';
import { cn, randomToken } from '@/lib/utils';

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
  // Attire only applies to Service and Other events.
  const showAttire = type === 'service' || type === 'other';

  function addScripture() {
    const s = scriptureDraft.trim();
    if (!s) return;
    setScriptures((prev) => [...prev, s]);
    setScriptureDraft('');
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

        {/* Attire — collapsible; only for Service and Other events */}
        {showAttire && (
        <div className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setAttireOpen((o) => !o)}
            className="row-press flex w-full items-center justify-between px-4 py-3.5 text-left"
          >
            <span className="inline-flex items-center gap-2 font-semibold">
              <Shirt width={18} height={18} className="text-accent" /> Attire (optional)
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
