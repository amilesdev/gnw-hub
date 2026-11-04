'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CrossoverSetDTO } from '@/lib/crossover-sets';
import type { ProgramItem, TimedRow } from '@/lib/crossover-schedule';
import { Overlay } from '@/components/shared/Overlay';
import { ChevronDown, ChevronLeft, Clock, Pencil, Plus, Trash } from '@/components/shared/Icons';
import { apiFetch } from '@/lib/api-client';
import { formatEventDate, formatTimeLabel } from '@/lib/dates';
import { applyTimeEdit } from '@/lib/rehearsal-schedule';
import { cn, randomToken } from '@/lib/utils';

type Base = '/home' | '/dashboard';
type View = 'dayOf' | 'dress' | 'program';
type Schedule = { dayOf: TimedRow[]; dress: TimedRow[]; program: ProgramItem[] };

const VIEWS: { value: View; label: string }[] = [
  { value: 'dayOf', label: 'Day-of' },
  { value: 'dress', label: 'Dress Reh.' },
  { value: 'program', label: 'Program' },
];

/**
 * Crossover schedules: the day of Crossover (Dec 31) and the Dress Rehearsal +
 * Setup (Dec 30), each a timed run-of-show that carries over from last year,
 * and the program — the order of the night with its cues, where set rows show
 * that set's songs and singers straight from Sets.
 */
export function CrossoverSchedule({
  base,
  year,
  initial,
  sets,
  canManage,
}: {
  base: Base;
  year: number;
  initial: Schedule;
  sets: CrossoverSetDTO[];
  canManage: boolean;
}) {
  const [schedule, setSchedule] = useState(initial);
  const [view, setView] = useState<View>('dayOf');
  const [editing, setEditing] = useState(false);
  const setById = new Map(sets.map((s) => [s.id, s]));

  const dayLabel = (day: 30 | 31) => formatEventDate(new Date(Date.UTC(year, 11, day)));

  return (
    <div className="space-y-5 pt-2">
      <Link
        href={`${base}/crossover`}
        className="row-press -ml-1 inline-flex items-center gap-0.5 rounded-lg py-1 text-[15px] font-semibold text-accent-ink dark:text-accent-on"
      >
        <ChevronLeft width={18} height={18} /> Crossover
      </Link>

      <header className="flex items-end justify-between gap-2 pr-12">
        <div>
          <div className="eyebrow">Crossover {year}</div>
          <h1 className="page-title mt-2">Schedule</h1>
        </div>
        {canManage && (
          <button type="button" className="btn-ghost border border-line !px-4 !py-3" onClick={() => setEditing(true)}>
            <Pencil width={16} height={16} /> Edit
          </button>
        )}
      </header>

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => setView(v.value)}
            className={cn(
              'rounded-xl py-2 text-sm font-semibold transition active:scale-[0.97]',
              view === v.value ? 'bg-surface text-ink shadow-card' : 'text-ink-soft',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'program' ? (
        <section className="space-y-2">
          <p className="text-sm text-ink-soft">The order of the night. Sets show their songs and singers from Sets.</p>
          {schedule.program.length === 0 ? (
            <Empty canManage={canManage} />
          ) : (
            <ol className="space-y-2">
              {schedule.program.map((item, i) => {
                const set = item.setId ? setById.get(item.setId) : undefined;
                if (item.setId && !set) return null; // its set was deleted
                return (
                  <li key={item.id} className={cn('flex gap-3 rounded-3xl p-3.5', set ? 'card' : 'border border-line')}>
                    <span
                      className={cn(
                        'grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold',
                        set ? 'bg-crossover-ever text-crossover-gold-hi' : 'bg-surface-2 text-ink-soft',
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('font-semibold', set && 'font-display text-lg')}>{set ? set.name : item.label}</span>
                        {set?.minutes != null && (
                          <span className="chip bg-surface-2 text-ink-soft">
                            <Clock width={12} height={12} /> {set.minutes} min
                          </span>
                        )}
                      </div>
                      {set && set.songs.length > 0 && (
                        <p className="text-sm text-ink-soft">{set.songs.map((s) => s.songTitle).join(' · ')}</p>
                      )}
                      {set && set.singers.length > 0 && (
                        <p className="text-xs text-ink-faint">
                          {set.singers.map((s) => `${s.name.split(' ')[0]} (${s.part[0]})`).join(', ')}
                        </p>
                      )}
                      {item.cue && (
                        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[#8F5E1C] dark:text-[#E0A75E]">
                          <span className="chip bg-warn/15 !px-1.5 !py-0.5 text-[10px] tracking-wider">CUE</span>
                          {item.cue}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ) : (
        <section className="card px-4 py-1">
          <div className="flex items-center justify-between gap-2 py-3">
            <span className="font-semibold">
              {view === 'dayOf' ? `${dayLabel(31)} · Day of Crossover` : `${dayLabel(30)} · Dress Rehearsal + Setup`}
            </span>
          </div>
          {schedule[view].length === 0 ? (
            <div className="border-t border-line py-4">
              <Empty canManage={canManage} />
            </div>
          ) : (
            <ul>
              {schedule[view].map((r, i) => (
                <li key={i} className="flex items-baseline gap-4 border-t border-line py-3">
                  <span className="w-[4.5rem] shrink-0 text-sm font-bold text-accent-ink tabular-nums dark:text-accent-on">
                    {r.time ? formatTimeLabel(r.time) : '—'}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{r.label}</span>
                    {r.note && <span className="block text-sm text-ink-soft">{r.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {editing && (
        <ScheduleEditor
          view={view}
          schedule={schedule}
          sets={sets}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setSchedule(next);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

function Empty({ canManage }: { canManage: boolean }) {
  return (
    <p className="rounded-2xl bg-surface-2 px-4 py-5 text-center text-sm text-ink-faint">
      Nothing here yet.{canManage ? ' Tap Edit to build it.' : ''}
    </p>
  );
}

/** Edit whichever view is open: a timed schedule (time edits shift later rows) or the program. */
function ScheduleEditor({
  view,
  schedule,
  sets,
  onClose,
  onSaved,
}: {
  view: View;
  schedule: Schedule;
  sets: CrossoverSetDTO[];
  onClose: () => void;
  onSaved: (next: Schedule) => void;
}) {
  const [rows, setRows] = useState<TimedRow[]>(view === 'program' ? [] : schedule[view]);
  // A program that's never been built starts from the sets, in order.
  const [items, setItems] = useState<ProgramItem[]>(
    schedule.program.length ? schedule.program : sets.map((s) => ({ id: randomToken(8), setId: s.id })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setById = new Map(sets.map((s) => [s.id, s]));
  const unusedSets = sets.filter((s) => !items.some((i) => i.setId === s.id));

  function move<T>(list: T[], i: number, by: -1 | 1): T[] {
    const next = [...list];
    const [x] = next.splice(i, 1);
    next.splice(i + by, 0, x);
    return next;
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = view === 'program' ? { program: items } : { [view]: rows };
      const next = await apiFetch<Schedule>('/api/crossover/schedule', { method: 'PATCH', body: JSON.stringify(body) });
      onSaved(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setBusy(false);
    }
  }

  const title = view === 'program' ? 'Edit program' : view === 'dayOf' ? 'Edit day-of schedule' : 'Edit Dress Rehearsal';

  return (
    <Overlay
      title={title}
      onClose={onClose}
      action={
        <button type="button" className="btn-primary !px-4 !py-2.5" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <div className="space-y-4">
        {view === 'program' ? (
          <>
            <ol className="space-y-2.5">
              {items.map((item, i) => {
                const set = item.setId ? setById.get(item.setId) : undefined;
                return (
                  <li key={item.id} className="card space-y-2 p-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-xs font-bold text-ink-faint tabular-nums">{i + 1}</span>
                      {item.setId ? (
                        <span className="min-w-0 flex-1 truncate font-display text-lg font-semibold">
                          {set?.name ?? 'Deleted set'}
                        </span>
                      ) : (
                        <input
                          className="field min-w-0 flex-1 !py-2.5"
                          value={item.label ?? ''}
                          onChange={(e) => setItems((p) => p.map((x) => (x.id === item.id ? { ...x, label: e.target.value } : x)))}
                          placeholder="Welcome, Poem, Message…"
                          aria-label={`Item ${i + 1}`}
                        />
                      )}
                      <MoveButtons
                        onUp={i > 0 ? () => setItems((p) => move(p, i, -1)) : undefined}
                        onDown={i < items.length - 1 ? () => setItems((p) => move(p, i, 1)) : undefined}
                        onRemove={() => setItems((p) => p.filter((x) => x.id !== item.id))}
                      />
                    </div>
                    <input
                      className="field !py-2.5 text-sm"
                      value={item.cue ?? ''}
                      onChange={(e) => setItems((p) => p.map((x) => (x.id === item.id ? { ...x, cue: e.target.value } : x)))}
                      placeholder="Cue (optional), e.g. Line up for Set 2"
                      aria-label={`Cue for item ${i + 1}`}
                    />
                  </li>
                );
              })}
            </ol>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-ghost flex-1"
                onClick={() => setItems((p) => [...p, { id: randomToken(8), label: '' }])}
              >
                <Plus width={16} height={16} /> Add segment
              </button>
              {unusedSets.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="btn-ghost flex-1"
                  onClick={() => setItems((p) => [...p, { id: randomToken(8), setId: s.id }])}
                >
                  <Plus width={16} height={16} /> {s.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-ink-faint">Editing a time shifts every row after it.</p>
            <ul className="space-y-2.5">
              {rows.map((r, i) => (
                <li key={i} className="card space-y-2 p-3">
                  <div className="flex items-center gap-2">
                    <div className="relative w-28 shrink-0">
                      <input
                        type="time"
                        value={r.time}
                        onChange={(e) => setRows((p) => applyTimeEdit(p, i, e.target.value))}
                        aria-label={`Row ${i + 1} time`}
                        className={cn('field min-w-0 !py-2.5 px-3', !r.time && 'text-transparent')}
                      />
                      {!r.time && (
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-faint">Time</span>
                      )}
                    </div>
                    <input
                      className="field min-w-0 flex-1 !py-2.5"
                      value={r.label}
                      onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                      placeholder="Call time, Sound check…"
                      aria-label={`Row ${i + 1} label`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="field min-w-0 flex-1 !py-2.5 text-sm"
                      value={r.note ?? ''}
                      onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
                      placeholder="Note (optional)"
                      aria-label={`Row ${i + 1} note`}
                    />
                    <MoveButtons
                      onUp={i > 0 ? () => setRows((p) => move(p, i, -1)) : undefined}
                      onDown={i < rows.length - 1 ? () => setRows((p) => move(p, i, 1)) : undefined}
                      onRemove={() => setRows((p) => p.filter((_, j) => j !== i))}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-ghost w-full" onClick={() => setRows((p) => [...p, { time: '', label: '' }])}>
              <Plus width={16} height={16} /> Add row
            </button>
          </>
        )}
        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
      </div>
    </Overlay>
  );
}

function MoveButtons({ onUp, onDown, onRemove }: { onUp?: () => void; onDown?: () => void; onRemove: () => void }) {
  return (
    <span className="flex shrink-0 items-center">
      <button
        type="button"
        onClick={onUp}
        disabled={!onUp}
        className="row-press grid h-8 w-8 place-items-center rounded-lg text-ink-soft disabled:opacity-30"
        aria-label="Move up"
      >
        <ChevronDown width={16} height={16} className="rotate-180" />
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={!onDown}
        className="row-press grid h-8 w-8 place-items-center rounded-lg text-ink-soft disabled:opacity-30"
        aria-label="Move down"
      >
        <ChevronDown width={16} height={16} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="row-press grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:text-bad"
        aria-label="Remove"
      >
        <Trash width={15} height={15} />
      </button>
    </span>
  );
}
