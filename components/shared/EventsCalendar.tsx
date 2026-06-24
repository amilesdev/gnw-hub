'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EventDTO } from '@/lib/serialize';
import { EventCard } from './EventCard';
import { EVENT_DOT_STYLES } from './EventTypeBadge';
import { Pencil, Trash, ChevronLeft, ChevronRight } from './Icons';
import { apiFetch } from '@/lib/api-client';
import { formatMonthLabel, monthKey, formatEventDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Day-of-month key for grouping (events are stored at UTC midnight). */
function dayOf(iso: string): number {
  return new Date(iso).getUTCDate();
}

export function EventsCalendar({
  canManage,
  refreshSignal,
  onOpen,
  onEdit,
  onDelete,
}: {
  canManage: boolean;
  refreshSignal: number;
  onOpen: (e: EventDTO) => void;
  onEdit: (e: EventDTO) => void;
  onDelete: (e: EventDTO) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => monthKey(today)); // "YYYY-MM"
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
  const isCurrentMonth = monthKey(today) === cursor;
  const todayDate = today.getDate();

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setCursor(monthKey(d));
    setSelectedDay(null);
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedEvents = selectedDay ? byDay.get(selectedDay) ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => shiftMonth(-1)} className="row-press grid h-10 w-10 place-items-center rounded-xl text-ink-soft" aria-label="Previous month">
          <ChevronLeft width={22} height={22} />
        </button>
        <h2 className="font-display text-lg font-semibold">{formatMonthLabel(cursor)}</h2>
        <button type="button" onClick={() => shiftMonth(1)} className="row-press grid h-10 w-10 place-items-center rounded-xl text-ink-soft" aria-label="Next month">
          <ChevronRight width={22} height={22} />
        </button>
      </div>

      <div className="card p-3">
        <div className="grid grid-cols-7 gap-1 pb-1">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="py-1 text-center text-xs font-bold text-ink-faint">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={`b${i}`} />;
            const isToday = isCurrentMonth && day === todayDate;
            const isSelected = day === selectedDay;
            // One dot per distinct event type that day, colored by type.
            const dayTypes = Array.from(new Set((byDay.get(day) ?? []).map((e) => e.type)));
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={
                  'relative grid aspect-square place-items-center rounded-xl text-sm font-semibold transition active:scale-95 ' +
                  (isSelected
                    ? 'bg-accent text-white'
                    : isToday
                    ? 'bg-accent/10 text-accent-ink'
                    : 'text-ink hover:bg-surface-2')
                }
              >
                {day}
                {dayTypes.length > 0 && (
                  <span className="absolute bottom-1 flex gap-0.5">
                    {dayTypes.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className={cn('h-1.5 w-1.5 rounded-full', isSelected ? 'bg-white' : EVENT_DOT_STYLES[t])}
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
        <div className="h-2 w-24 animate-breathe rounded-full bg-accent/30" />
      ) : selectedDay === null ? (
        <p className="text-center text-sm text-ink-faint">Pick a day to see its events.</p>
      ) : selectedEvents.length === 0 ? (
        <p className="text-center text-sm text-ink-faint">
          Nothing on {formatEventDate(new Date(Date.UTC(year, month - 1, selectedDay)))}.
        </p>
      ) : (
        <div className="space-y-3">
          <h3 className="eyebrow">{formatEventDate(new Date(Date.UTC(year, month - 1, selectedDay)))}</h3>
          {selectedEvents.map((event) => (
            <div key={event.id} className="space-y-2">
              <EventCard event={event} onClick={() => onOpen(event)} />
              {canManage && (
                <div className="flex gap-2 px-1">
                  <button className="btn-ghost !py-2 text-sm" onClick={() => onEdit(event)} type="button">
                    <Pencil width={15} height={15} /> Edit
                  </button>
                  <button className="btn-ghost !py-2 text-sm text-bad" onClick={() => onDelete(event)} type="button">
                    <Trash width={15} height={15} /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
