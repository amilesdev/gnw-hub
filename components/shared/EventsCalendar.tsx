'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EventDTO } from '@/lib/serialize';
import { EventRow, EventRowList } from './EventCard';
import { EVENT_DOT_STYLES } from './EventTypeBadge';
import { ChevronLeft, ChevronRight } from './Icons';
import { EventCardSkeleton, Skeleton, SkeletonList } from './Skeleton';
import { InlineEmpty } from './EmptyState';
import { apiFetch } from '@/lib/api-client';
import { formatMonthLabel, formatEventDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Day-of-month key for grouping (events are stored at UTC midnight). */
function dayOf(iso: string): number {
  return new Date(iso).getUTCDate();
}

/**
 * "YYYY-MM" for a date read in the viewer's local zone. The calendar shows the
 * user's own wall-clock month, and its cells select by day number — which lines
 * up with UTC-midnight event dates. Reading "today" in UTC here (as monthKey
 * does) drifts a month ahead late on the last day of the month (e.g. the evening
 * of June 30 in the US is already July 1 UTC → the grid jumped to July 30).
 */
function localMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Events › Month (EV-2): the month grid card, then the selected day's rows. */
export function EventsCalendar({
  canManage,
  refreshSignal,
  onOpen,
  onMore,
}: {
  canManage: boolean;
  refreshSignal: number;
  onOpen: (e: EventDTO) => void;
  onMore: (e: EventDTO) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => localMonthKey(today)); // "YYYY-MM"
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());

  const [year, month] = cursor.split('-').map(Number); // month is 1-based

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<{ events: EventDTO[] }>(`/api/events?scope=month&month=${cursor}`)
      .then(({ events }) => {
        if (active) setEvents(events);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [cursor, refreshSignal]);

  // Events grouped by day-of-month for quick dot/marker lookup.
  const byDay = useMemo(() => {
    const map = new Map<number, EventDTO[]>();
    for (const e of events) {
      const d = dayOf(e.date);
      const list = map.get(d) ?? [];
      list.push(e);
      map.set(d, list);
    }
    return map;
  }, [events]);

  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const thisMonth = localMonthKey(today);
  const isCurrentMonth = thisMonth === cursor;
  const isPastMonth = cursor < thisMonth;
  const todayDate = today.getDate();

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setCursor(localMonthKey(d));
    setSelectedDay(null);
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedEvents = selectedDay ? byDay.get(selectedDay) ?? [] : [];
  const selectedLabel = selectedDay ? formatEventDate(new Date(Date.UTC(year, month - 1, selectedDay))) : '';

  return (
    <div className="space-y-6">
      <div className="card px-3 pb-3.5 pt-2">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => shiftMonth(-1)} className="btn-icon" aria-label="Previous month">
            <ChevronLeft width={22} height={22} />
          </button>
          <h2 className="font-display text-lg font-semibold">{formatMonthLabel(cursor)}</h2>
          <button type="button" onClick={() => shiftMonth(1)} className="btn-icon" aria-label="Next month">
            <ChevronRight width={22} height={22} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="text-center text-xs font-bold leading-6 text-ink-faint">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={`b${i}`} />;
            const isToday = isCurrentMonth && day === todayDate;
            const isSelected = day === selectedDay;
            const isPast = isPastMonth || (isCurrentMonth && day < todayDate);
            // One dot per distinct event type that day, colored by type.
            const dayTypes = Array.from(new Set((byDay.get(day) ?? []).map((e) => e.type)));
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                aria-pressed={isSelected}
                className={cn(
                  'relative flex h-11 flex-col items-center justify-center rounded-[14px] text-[15px] font-semibold transition duration-150 active:scale-95',
                  isSelected
                    ? 'bg-accent text-accent-fg'
                    : isToday
                      ? 'bg-accent-soft text-accent-ink'
                      : isPast
                        ? 'text-ink-faint'
                        : 'text-ink',
                )}
              >
                {day}
                {dayTypes.length > 0 && (
                  <span className="absolute bottom-1 flex gap-0.5" aria-hidden>
                    {dayTypes.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className={cn('h-[5px] w-[5px] rounded-full', isSelected ? 'bg-accent-fg' : EVENT_DOT_STYLES[t])}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <SkeletonList>
          <Skeleton className="h-3 w-24" />
          <EventCardSkeleton />
        </SkeletonList>
      ) : selectedDay === null ? (
        <InlineEmpty>Pick a day to see its events.</InlineEmpty>
      ) : selectedEvents.length === 0 ? (
        <InlineEmpty>Nothing on {selectedLabel}.</InlineEmpty>
      ) : (
        <section className="space-y-3">
          <h3 className="eyebrow">{selectedLabel}</h3>
          <EventRowList>
            {selectedEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                onClick={() => onOpen(event)}
                onMore={canManage ? () => onMore(event) : undefined}
              />
            ))}
          </EventRowList>
        </section>
      )}
    </div>
  );
}
