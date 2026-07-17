'use client';

import { useEffect, useMemo, useState } from 'react';
import type { UnavailabilityDTO } from '@/lib/serialize';
import Link from 'next/link';
import { CalendarOff, ChevronLeft } from '@/components/shared/Icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonList, EventCardSkeleton } from '@/components/shared/Skeleton';
import { MonthCalendar } from '@/components/shared/MonthCalendar';
import { apiFetch } from '@/lib/api-client';
import { formatEventDate, parseCalendarDate, eachDayYmd } from '@/lib/dates';
import { cn } from '@/lib/utils';

type DayEntry = { id: string; userName: string; part: string | null; reason: string | null };

/**
 * Read-only "who's away" overview for leaders. A month calendar up top marks
 * every day someone is unavailable with a gray dot; tapping a marked day filters
 * the list below to just that day. The list groups members by day, so it's easy
 * to see everyone off on a given Sunday/rehearsal at a glance.
 */
export function TeamAvailability() {
  const [rows, setRows] = useState<UnavailabilityDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ availability: UnavailabilityDTO[] }>('/api/availability?scope=team')
      .then(({ availability }) => setRows(availability))
      .catch(() => setError('Could not load team availability.'));
  }, []);

  const now = new Date();
  const todayYmd = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  // Expand every block into its individual days → { ymd → members off that day }.
  // Past days within a still-running range are dropped; a member appears once per
  // day even if two blocks overlap.
  const byDay = useMemo(() => {
    const map = new Map<string, DayEntry[]>();
    for (const r of rows ?? []) {
      for (const ymd of eachDayYmd(r.startDate, r.endDate)) {
        if (ymd < todayYmd) continue;
        const list = map.get(ymd) ?? [];
        if (!list.some((e) => e.id === r.id)) {
          list.push({ id: r.id, userName: r.userName ?? 'Member', part: r.part ?? null, reason: r.reason });
        }
        map.set(ymd, list);
      }
    }
    return map;
  }, [rows, todayYmd]);

  const days = useMemo(() => [...byDay.keys()].sort(), [byDay]);
  const visibleDays = selectedDay ? days.filter((d) => d === selectedDay) : days;

  return (
    <div className="space-y-5 pt-2">
      <header>
        <Link
          href="/dashboard/events"
          aria-label="Back to Events"
          className="row-press -ml-2 mb-1 grid h-10 w-10 place-items-center rounded-xl text-ink-soft"
        >
          <ChevronLeft width={22} height={22} />
        </Link>
        <h1 className="page-title mt-2">Team Availability</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Days with a dot have someone marked unavailable. Tap to focus, or scroll the list to see
          members grouped by day.
        </p>
      </header>

      {error && <p className="text-sm font-semibold text-bad">{error}</p>}

      {!rows && !error && (
        <SkeletonList>
          <EventCardSkeleton />
          <EventCardSkeleton />
          <EventCardSkeleton />
        </SkeletonList>
      )}

      {rows && (
        <>
          <MonthCalendar
            renderDay={(ymd, { isToday }) => {
              const has = byDay.has(ymd);
              const isSel = ymd === selectedDay;
              return {
                className: cn(
                  isSel && 'bg-accent text-white',
                  !isSel && isToday && 'bg-accent/10 text-accent-ink dark:text-accent-on',
                  !isSel && !isToday && 'hover:bg-surface-2',
                ),
                dot: has ? (
                  <span
                    className={cn('absolute bottom-1 h-1.5 w-1.5 rounded-full', isSel ? 'bg-white' : 'bg-ink-faint')}
                  />
                ) : null,
              };
            }}
            // Tapping a day with people off focuses it; tapping it again (or an
            // empty day) clears back to the full list.
            onDayClick={(ymd) => setSelectedDay((cur) => (cur === ymd || !byDay.has(ymd) ? null : ymd))}
          />

          {selectedDay && (
            <button type="button" className="btn-ghost w-full !py-2 text-sm" onClick={() => setSelectedDay(null)}>
              Show all dates
            </button>
          )}

          {days.length === 0 ? (
            <EmptyState message="Nobody’s marked any upcoming days off. You’re clear to schedule." />
          ) : (
            <div className="space-y-6">
              {visibleDays.map((ymd) => {
                const members = byDay.get(ymd) ?? [];
                return (
                  <section key={ymd} className="space-y-3">
                    <div className="flex items-baseline justify-between">
                      <h2 className="eyebrow">{formatEventDate(parseCalendarDate(ymd))}</h2>
                      <span className="text-xs text-ink-faint">{members.length} away</span>
                    </div>
                    {members.map((m) => (
                      <div key={m.id} className="card flex items-center gap-3 p-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warn/10 text-warn">
                          <CalendarOff width={19} height={19} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{m.userName}</p>
                          {m.reason && <p className="truncate text-sm text-ink-soft">{m.reason}</p>}
                        </div>
                        {m.part && (
                          <span className="chip shrink-0 bg-surface-2 capitalize text-ink-soft">{m.part}</span>
                        )}
                      </div>
                    ))}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
