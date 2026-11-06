'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { EventDTO } from '@/lib/serialize';
import { EventRow, EventRowList } from './EventCard';
import { EventDetail } from './EventDetail';
import { EventsCalendar } from './EventsCalendar';
import { EventActions } from './EventActions';
import { EVENT_DOT_STYLES } from './EventTypeBadge';
import { EmptyState, InlineEmpty } from './EmptyState';
import { EventCardSkeleton, Skeleton, SkeletonList } from './Skeleton';
import { ScreenHeader } from './ScreenHeader';
import { SegmentedControl } from './SegmentedControl';
import { Plus, CalendarOff, Calendar } from './Icons';
import { EventForm } from '@/components/leader/EventForm';
import { apiFetch } from '@/lib/api-client';
import { useDataChanged } from '@/lib/data-changed';
import { startOfToday, toYmd } from '@/lib/dates';
import { groupAgenda, weekStripDays } from '@/lib/event-groups';
import { cn } from '@/lib/utils';

type FormState = { mode: 'create' } | { mode: 'edit'; event: EventDTO } | null;
type View = 'agenda' | 'month';

/**
 * Events (EV-1/EV-2): Agenda | Month (in `?view=month`). Agenda opens with a
 * week strip — the next 7 days, tap one to jump to it — then the events grouped
 * Today / This week / Next week / by month, one card of rows per group.
 * Leaders get a More menu on every row (Edit / Delete) instead of buttons.
 */
export function EventsScreen({
  canManage,
  initialEvents,
}: {
  canManage: boolean;
  initialEvents?: EventDTO[];
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [events, setEvents] = useState<EventDTO[]>(initialEvents ?? []);
  const [loading, setLoading] = useState(initialEvents === undefined);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>(params.get('view') === 'month' ? 'month' : 'agenda');
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [detail, setDetail] = useState<EventDTO | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [more, setMore] = useState<EventDTO | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  /** `quiet` keeps what's on screen while it reloads (no skeleton flash). */
  async function load(quiet = false) {
    if (!quiet) setLoading(true);
    setFailed(false);
    try {
      const { events } = await apiFetch<{ events: EventDTO[] }>('/api/events?scope=all');
      setEvents(events);
    } catch {
      if (!quiet) setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  // A save elsewhere (an event's setlist, availability…) or a newer copy.
  useDataChanged(() => {
    load(true).catch(() => {});
    setRefreshSignal((n) => n + 1);
  });

  // Reload the list and signal the calendar to refetch its visible month.
  function refreshAll() {
    load(true);
    setRefreshSignal((n) => n + 1);
  }

  useEffect(() => {
    if (initialEvents !== undefined) return; // already seeded on the server — skip the initial fetch
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchTo(next: View) {
    setView(next);
    // A client-side view switch: replace the URL, no history entry, no refetch.
    window.history.replaceState(null, '', next === 'month' ? `${pathname}?view=month` : pathname);
  }

  const today = startOfToday();
  const groups = useMemo(() => groupAgenda(events), [events]);
  const monthName = today.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });

  // Week strip: jump to a day's first row and flash it.
  function jumpTo(ymd: string) {
    const el = document.querySelector(`[data-day="${ymd}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlash(ymd);
    window.setTimeout(() => setFlash((f) => (f === ymd ? null : f)), 600);
  }

  // Only the first row of each day carries the anchor.
  const seenDays = new Set<string>();

  return (
    <div>
      <ScreenHeader
        eyebrow={canManage ? 'Leader tools' : 'GNW Hub'}
        title="Events"
        actions={
          canManage && (
            <>
              <Link
                href="/dashboard/availability/team"
                className="glass grid h-11 w-11 place-items-center rounded-full text-ink-soft transition-transform duration-150 active:scale-[0.97]"
                aria-label="Team availability, who’s away"
                title="Who’s away"
              >
                <CalendarOff width={20} height={20} />
              </Link>
              <button type="button" className="btn-primary btn-sm h-11" onClick={() => setForm({ mode: 'create' })}>
                <Plus width={16} height={16} /> Add
              </button>
            </>
          )
        }
      />

      <div className="mb-6 flex items-center justify-between gap-3">
        <SegmentedControl
          variant="glass"
          role="tablist"
          aria-label="Events view"
          options={[
            { value: 'agenda', label: 'Agenda' },
            { value: 'month', label: 'Month' },
          ]}
          value={view}
          onChange={switchTo}
        />
        {view === 'agenda' && <p className="t-title">{monthName}</p>}
      </div>

      {view === 'month' ? (
        <EventsCalendar
          canManage={canManage}
          refreshSignal={refreshSignal}
          onOpen={(e) => setDetail(e)}
          onMore={(e) => setMore(e)}
        />
      ) : (
        <div className="space-y-6">
          <WeekStrip events={events} onPick={jumpTo} />

          {failed ? (
            <InlineEmpty>
              Could not load events.
              <button type="button" className="btn-ghost btn-sm mx-auto mt-3 flex" onClick={() => void load()}>
                Try again
              </button>
            </InlineEmpty>
          ) : loading ? (
            <SkeletonList className="space-y-6">
              {[0, 1].map((i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-3 w-20" />
                  <EventCardSkeleton rows={3} />
                </div>
              ))}
            </SkeletonList>
          ) : events.length === 0 ? (
            <EmptyState
              icon={Calendar}
              message={
                canManage
                  ? 'No upcoming events yet. Add one to get the team ready.'
                  : 'No upcoming events right now. Rest up. More is coming.'
              }
            />
          ) : (
            groups.map((g) => (
              <section key={g.label} className="space-y-3">
                <h2 className="eyebrow">{g.label}</h2>
                <EventRowList>
                  {g.events.map((event) => {
                    const ymd = event.date.slice(0, 10);
                    const anchor = !seenDays.has(ymd);
                    seenDays.add(ymd);
                    return (
                      <div
                        key={event.id}
                        data-day={anchor ? ymd : undefined}
                        className={cn('transition-colors duration-300', flash === ymd && 'bg-surface-2')}
                      >
                        <EventRow
                          event={event}
                          onClick={() => setDetail(event)}
                          onMore={canManage ? () => setMore(event) : undefined}
                        />
                      </div>
                    );
                  })}
                </EventRowList>
              </section>
            ))
          )}
        </div>
      )}

      {detail && (
        <EventDetail
          event={detail}
          backLabel="Events"
          onClose={() => setDetail(null)}
          onEdit={canManage ? (e) => setForm({ mode: 'edit', event: e }) : undefined}
          onDeleted={() => {
            setDetail(null);
            refreshAll();
          }}
        />
      )}

      {canManage && (
        <EventActions
          event={more}
          onClose={() => setMore(null)}
          onEdit={(e) => setForm({ mode: 'edit', event: e })}
          onDeleted={refreshAll}
        />
      )}

      {form?.mode === 'create' && (
        <EventForm mode="create" onClose={() => setForm(null)} onSaved={() => { setForm(null); refreshAll(); }} />
      )}
      {form?.mode === 'edit' && (
        <EventForm mode="edit" initial={form.event} onClose={() => setForm(null)} onSaved={() => { setForm(null); refreshAll(); }} />
      )}
    </div>
  );
}

/** EV-C6: the 7 days from today; a day with events jumps the agenda to it. */
function WeekStrip({ events, onPick }: { events: EventDTO[]; onPick: (ymd: string) => void }) {
  const days = weekStripDays();
  const todayYmd = toYmd(startOfToday());
  const byDay = useMemo(() => {
    const m = new Map<string, EventDTO['type'][]>();
    for (const e of events) {
      const k = e.date.slice(0, 10);
      const types = m.get(k) ?? [];
      if (!types.includes(e.type)) types.push(e.type);
      m.set(k, types);
    }
    return m;
  }, [events]);

  return (
    <div className="card grid grid-cols-7 px-1.5 py-2.5">
      {days.map((ymd) => {
        const d = new Date(`${ymd}T00:00:00.000Z`);
        const types = byDay.get(ymd) ?? [];
        const isToday = ymd === todayYmd;
        const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
        return (
          <button
            key={ymd}
            type="button"
            disabled={types.length === 0}
            onClick={() => onPick(ymd)}
            aria-label={types.length ? `${label}, jump to events` : `${label}, no events`}
            className="flex flex-col items-center gap-1 rounded-2xl py-0.5 transition-transform duration-150 enabled:active:scale-95"
          >
            <span className="text-[11px] font-bold leading-[14px] text-ink-faint">
              {d.toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' })}
            </span>
            <span
              className={cn(
                'grid h-10 w-10 place-items-center rounded-full text-base font-bold',
                isToday ? 'bg-accent text-accent-fg' : 'text-ink',
              )}
            >
              {d.getUTCDate()}
            </span>
            <span className="flex h-1.5 gap-0.5" aria-hidden>
              {types.slice(0, 3).map((t) => (
                <span key={t} className={cn('h-1.5 w-1.5 rounded-full', EVENT_DOT_STYLES[t])} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
