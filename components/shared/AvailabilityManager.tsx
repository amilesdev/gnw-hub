'use client';

import { useEffect, useMemo, useState } from 'react';
import type { UnavailabilityDTO } from '@/lib/serialize';
import { CalendarOff, Plus, Trash, Check } from './Icons';
import { TextField } from './Field';
import { EmptyState } from './EmptyState';
import { MonthCalendar } from './MonthCalendar';
import { apiFetch } from '@/lib/api-client';
import { formatEventDate, parseCalendarDate, eachDayYmd } from '@/lib/dates';
import { cn } from '@/lib/utils';

/**
 * A member's own blackout dates: the list they've marked, plus a calendar to add
 * more. Tapping one day marks that single day; tapping a second day makes the two
 * the ends of a range (a vacation stretch). Tapping again starts over. Whole-day
 * only — a block applies to every event on those dates. Always acts on the
 * signed-in user (the API infers "self" when no userId is sent).
 */
export function AvailabilityManager() {
  const [rows, setRows] = useState<UnavailabilityDTO[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // In-progress selection. selStart with no selEnd = a single day so far.
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  async function load() {
    try {
      const { availability } = await apiFetch<{ availability: UnavailabilityDTO[] }>('/api/availability');
      setRows(availability);
    } catch {
      setLoadError('Could not load your availability.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Days already marked off (ranges expanded) — shown as dots so you don't
  // double-book a day you've already blocked.
  const markedDays = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows ?? []) for (const d of eachDayYmd(r.startDate, r.endDate)) set.add(d);
    return set;
  }, [rows]);

  // Tap logic: first tap (or a tap after a complete range) starts a fresh single
  // day; the next tap closes a range, auto-ordering the two ends.
  function tapDay(ymd: string) {
    setError(null);
    setJustAdded(false);
    if (!selStart || selEnd) {
      setSelStart(ymd);
      setSelEnd(null);
    } else if (ymd === selStart) {
      // tapping the same day again clears it
      setSelStart(null);
    } else if (ymd < selStart) {
      setSelEnd(selStart);
      setSelStart(ymd);
    } else {
      setSelEnd(ymd);
    }
  }

  function clearSelection() {
    setSelStart(null);
    setSelEnd(null);
  }

  async function add() {
    if (!selStart) return setError('Tap a day on the calendar first.');
    setBusy(true);
    setError(null);
    try {
      const { availability } = await apiFetch<{ availability: UnavailabilityDTO }>('/api/availability', {
        method: 'POST',
        body: JSON.stringify({ startDate: selStart, endDate: selEnd ?? selStart, reason: reason.trim() || null }),
      });
      setRows((prev) => [...(prev ?? []), availability].sort((a, b) => a.startDate.localeCompare(b.startDate)));
      clearSelection();
      setReason('');
      setJustAdded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that date.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const prev = rows;
    setRows((r) => (r ?? []).filter((x) => x.id !== id));
    try {
      await apiFetch(`/api/availability/${id}`, { method: 'DELETE' });
    } catch {
      setRows(prev ?? null);
    }
  }

  const selHigh = selEnd ?? selStart;

  return (
    <div className="space-y-5 pt-2">
      <header>
        <div className="eyebrow">Scheduling</div>
        <h1 className="page-title mt-2">My Availability</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Tap a day you can’t serve; tap a second day for a stretch of days. Leaders see this so you
          aren’t scheduled for that Sunday or event.
        </p>
      </header>

      {/* Calendar picker — the reason + confirm hang off the calendar itself,
          revealed only once a day is tapped. */}
      <section>
        <MonthCalendar
          renderDay={(ymd, { isToday, isPast }) => {
            const inSel = Boolean(selStart) && ymd >= selStart! && ymd <= (selHigh as string);
            const isEnd = ymd === selStart || ymd === selEnd;
            return {
              disabled: isPast,
              className: cn(
                inSel && (isEnd ? 'bg-accent text-white' : 'bg-accent/20 text-accent-ink dark:text-accent-on'),
                !inSel && isToday && 'bg-accent/10 text-accent-ink dark:text-accent-on',
                !inSel && !isToday && !isPast && 'hover:bg-surface-2',
              ),
              // A subtle dot on days already blocked (unless it's in the current pick).
              dot:
                markedDays.has(ymd) && !inSel ? (
                  <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-ink-faint" />
                ) : null,
            };
          }}
          onDayClick={tapDay}
          footer={
            selStart ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="label">Selected</p>
                    <p className="mt-0.5 font-semibold">{formatRange(selStart, selHigh as string)}</p>
                  </div>
                  <button type="button" className="btn-ghost !py-2 text-sm" onClick={clearSelection}>
                    Clear
                  </button>
                </div>

                <TextField
                  label="Reason (optional)"
                  placeholder="Vacation, work…"
                  maxLength={200}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />

                {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}

                <button type="button" className="btn-primary w-full" disabled={busy} onClick={add}>
                  <Plus width={18} height={18} /> {busy ? 'Saving…' : 'Mark unavailable'}
                </button>
              </div>
            ) : null
          }
        />

        {justAdded && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-good">
            <Check width={16} height={16} /> Added.
          </p>
        )}
      </section>

      {/* Existing blocks */}
      <section className="space-y-3">
        <h2 className="eyebrow">Marked away</h2>
        {loadError && <p className="text-sm font-semibold text-bad">{loadError}</p>}
        {!rows && !loadError && <p className="text-sm text-ink-faint">Loading…</p>}
        {rows && rows.length === 0 && (
          <EmptyState message="No dates marked. Tap any days above you know you’ll be away." />
        )}
        {rows?.map((r) => (
          <div key={r.id} className="card flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-soft">
                <CalendarOff width={18} height={18} />
              </span>
              <div>
                <p className="font-semibold">{formatRange(r.startDate, r.endDate)}</p>
                {r.reason && <p className="text-sm text-ink-faint">{r.reason}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => remove(r.id)}
              aria-label="Remove"
              className="row-press grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-faint hover:text-bad"
            >
              <Trash width={17} height={17} />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

/** "Sun, Jul 20" for a single day, or "Jul 20 – Jul 26" for a range. */
function formatRange(startYmd: string, endYmd: string): string {
  const start = formatEventDate(parseCalendarDate(startYmd));
  if (startYmd === endYmd) return start;
  return `${start} – ${formatEventDate(parseCalendarDate(endYmd))}`;
}
