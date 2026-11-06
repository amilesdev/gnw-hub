'use client';

import { useEffect, useMemo, useState } from 'react';
import type { UnavailabilityDTO } from '@/lib/serialize';
import { CalendarOff } from '@/components/shared/Icons';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { listCard } from '@/lib/ui-classes';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton, SkeletonList, EventCardSkeleton } from '@/components/shared/Skeleton';
import { MonthCalendar } from '@/components/shared/MonthCalendar';
import { apiFetch } from '@/lib/api-client';
import { formatDateRange, formatMonthLabel, monthKey, parseCalendarDate, eachDayYmd } from '@/lib/dates';
import { cn } from '@/lib/utils';

// One member's unavailability, kept whole as a single range (not exploded into
// per-day rows). `effStartYmd` is the start clamped forward to today, so a range
// already under way sorts and groups as "unavailable now" rather than by a past
// start month.
type Entry = {
  id: string;
  userName: string;
  part: string | null;
  reason: string | null;
  startYmd: string;
  endYmd: string;
  effStartYmd: string;
};

/**
 * Read-only "who's away" overview for leaders. A month calendar up top marks
 * every day someone is unavailable with a gray dot; tapping a marked day filters
 * the list below to just entries covering that day. The list keeps each range as
 * a single card and groups them by month, ordered by who is unavailable soonest —
 * so a chosen range shows once, not as a wall of per-day rows.
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

  // Set of upcoming days that any range covers — drives the calendar dots only.
  // Past days within a still-running range are dropped.
  const coveredDays = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows ?? []) {
      for (const ymd of eachDayYmd(r.startDate, r.endDate)) {
        if (ymd < todayYmd) continue;
        set.add(ymd);
      }
    }
    return set;
  }, [rows, todayYmd]);

  // One entry per range (fully-past ranges dropped), ordered by who is
  // unavailable soonest. Ties broken by the earlier actual start — so where two
  // people's time off overlaps, whoever's range starts earlier is listed first.
  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];
    for (const r of rows ?? []) {
      if (r.endDate < todayYmd) continue;
      list.push({
        id: r.id,
        userName: r.userName ?? 'Member',
        part: r.part ?? null,
        reason: r.reason,
        startYmd: r.startDate,
        endYmd: r.endDate,
        effStartYmd: r.startDate < todayYmd ? todayYmd : r.startDate,
      });
    }
    list.sort(
      (a, b) =>
        a.effStartYmd.localeCompare(b.effStartYmd) ||
        a.startYmd.localeCompare(b.startYmd) ||
        a.endYmd.localeCompare(b.endYmd) ||
        a.userName.localeCompare(b.userName),
    );
    return list;
  }, [rows, todayYmd]);

  const visibleEntries = selectedDay
    ? entries.filter((e) => e.startYmd <= selectedDay && selectedDay <= e.endYmd)
    : entries;

  // Bucket the already-sorted entries into months (keyed by clamped start), so
  // Map insertion order stays chronological.
  const months = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of visibleEntries) {
      const key = monthKey(parseCalendarDate(e.effStartYmd));
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [visibleEntries]);

  return (
    <div className="space-y-6">
      <div>
        <ScreenHeader
          back={{ href: '/dashboard/events', label: 'Events' }}
          title="Team Availability"
          className="mb-0"
        />
        <p className="mt-2 text-[15px] leading-[22px] text-ink-soft">
          Days with a dot have someone marked unavailable. Tap to focus, or scroll the list to see members grouped by
          month, soonest first.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-[13px] font-semibold text-bad-ink">
          {error}
        </p>
      )}

      {!rows && !error && (
        <SkeletonList>
          <Skeleton className="h-[330px] w-full rounded-3xl" />
          <EventCardSkeleton rows={3} />
        </SkeletonList>
      )}

      {rows && (
        <>
          <MonthCalendar
            renderDay={(ymd, { isToday }) => {
              const has = coveredDays.has(ymd);
              const isSel = ymd === selectedDay;
              return {
                className: cn(
                  isSel && 'bg-accent text-accent-fg',
                  !isSel && isToday && 'bg-accent-soft text-accent-ink',
                ),
                dot: has ? (
                  <span
                    className={cn('absolute bottom-1 h-[5px] w-[5px] rounded-full', isSel ? 'bg-accent-fg' : 'bg-warn')}
                  />
                ) : null,
              };
            }}
            // Tapping a day with people off focuses entries covering it; tapping
            // it again (or an empty day) clears back to the full list.
            onDayClick={(ymd) => setSelectedDay((cur) => (cur === ymd || !coveredDays.has(ymd) ? null : ymd))}
          />

          {selectedDay && (
            <button type="button" className="btn-ghost btn-sm w-full" onClick={() => setSelectedDay(null)}>
              Show all dates
            </button>
          )}

          {months.length === 0 ? (
            <EmptyState message="Nobody’s marked any upcoming days off. You’re clear to schedule." />
          ) : (
            <div className="space-y-6">
              {months.map(([key, ents]) => (
                <section key={key} className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <h2 className="eyebrow">{formatMonthLabel(key)}</h2>
                    <span className="text-[13px] text-ink-faint">{ents.length} away</span>
                  </div>
                  <div className={listCard}>
                    {ents.map((e) => (
                      <div key={e.id} className="flex min-h-[68px] items-center gap-3 px-4 py-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-warn/[0.14] text-warn-ink">
                          <CalendarOff width={18} height={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="row-title truncate">{e.userName}</p>
                          <p className="truncate text-sm text-ink-soft">
                            {formatDateRange(e.startYmd, e.endYmd)}
                            {e.reason && ` · ${e.reason}`}
                          </p>
                        </div>
                        {e.part && (
                          <span className="chip shrink-0 bg-surface-2 capitalize text-ink-soft">{e.part}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
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
