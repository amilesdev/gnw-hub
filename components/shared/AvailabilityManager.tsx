'use client';

import { useEffect, useMemo, useState } from 'react';
import type { UnavailabilityDTO } from '@/lib/serialize';
import { CalendarOff, Plus, Trash, Check } from './Icons';
import { TextField } from './Field';
import { EmptyState } from './EmptyState';
import { ScreenHeader } from './ScreenHeader';
import { Skeleton } from './Skeleton';
import { useToast } from './Toast';
import { listCard } from '@/lib/ui-classes';
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
export function AvailabilityManager({ profileHref }: { profileHref: string }) {
  const [rows, setRows] = useState<UnavailabilityDTO[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // In-progress selection. selStart with no selEnd = a single day so far.
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const toast = useToast();

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

  // Gone at once; the delete is sent when the undo toast closes (CMP-22).
  function remove(id: string) {
    const removed = rows?.find((x) => x.id === id);
    if (!removed) return;
    const restore = () =>
      setRows((r) =>
        (r ?? []).some((x) => x.id === id)
          ? r
          : [...(r ?? []), removed].sort((a, b) => a.startDate.localeCompare(b.startDate)),
      );
    setRows((r) => (r ?? []).filter((x) => x.id !== id));
    toast.show({
      message: 'Dates removed.',
      undo: restore,
      commit: () => apiFetch(`/api/availability/${id}`, { method: 'DELETE' }).catch(restore),
    });
  }

  const selHigh = selEnd ?? selStart;

  return (
    <div className="space-y-6">
      <div>
        <ScreenHeader back={{ href: profileHref, label: 'Profile' }} eyebrow="Scheduling" title="My Availability" className="mb-0" />
        <p className="mt-2 text-[15px] leading-[22px] text-ink-soft">
          Tap a day you can’t serve, then tap a second day for a stretch of days. Leaders see this so you
          aren’t scheduled for that Sunday or event.
        </p>
      </div>

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
                inSel && (isEnd ? 'bg-accent text-accent-fg' : 'bg-accent/20 text-accent-ink'),
                !inSel && isToday && 'bg-accent-soft text-accent-ink',
              ),
              // A subtle dot on days already blocked (unless it's in the current pick).
              dot:
                markedDays.has(ymd) && !inSel ? (
                  <span className="absolute bottom-1 h-[5px] w-[5px] rounded-full bg-ink-faint" />
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
                    <p className="row-title mt-0.5">{formatRange(selStart, selHigh as string)}</p>
                  </div>
                  <button type="button" className="btn-ghost btn-sm" onClick={clearSelection}>
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

                {error && <p role="alert" className="text-[13px] font-semibold text-bad-ink">{error}</p>}

                <button type="button" className="btn-primary w-full" disabled={busy} onClick={add}>
                  <Plus width={18} height={18} /> {busy ? 'Saving…' : 'Mark unavailable'}
                </button>
              </div>
            ) : null
          }
        />

        {justAdded && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-good-ink">
            <Check width={16} height={16} /> Added.
          </p>
        )}
      </section>

      {/* Existing blocks */}
      <section className="space-y-3">
        <h2 className="eyebrow">Marked away</h2>
        {loadError && <p role="alert" className="text-[13px] font-semibold text-bad-ink">{loadError}</p>}
        {!rows && !loadError && (
          <div className="space-y-2" role="status" aria-label="Loading">
            <Skeleton className="h-[68px] w-full rounded-3xl" />
            <Skeleton className="h-[68px] w-full rounded-3xl" />
          </div>
        )}
        {rows && rows.length === 0 && (
          <EmptyState message="No dates marked. Tap any days above you know you’ll be away." />
        )}
        {rows && rows.length > 0 && (
          <div className={listCard}>
            {rows.map((r) => (
              <div key={r.id} className="flex min-h-[68px] items-center gap-3 py-3 pl-4 pr-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-soft">
                  <CalendarOff width={18} height={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="row-title">{formatRange(r.startDate, r.endDate)}</p>
                  {r.reason && <p className="truncate text-sm text-ink-faint">{r.reason}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  aria-label={`Remove ${formatRange(r.startDate, r.endDate)}`}
                  className="btn-icon shrink-0 text-ink-faint"
                >
                  <Trash width={18} height={18} />
                </button>
              </div>
            ))}
          </div>
        )}
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
