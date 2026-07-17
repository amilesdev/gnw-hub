'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from './Icons';
import { formatMonthLabel } from '@/lib/dates';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * "YYYY-MM" for a date read in the viewer's LOCAL zone — the grid shows the
 * user's own wall-clock month. Its day cells then produce UTC "YYYY-MM-DD" keys
 * (ymdOf) that line up with our UTC-midnight calendar dates. Reading the month
 * in UTC instead would jump a month ahead late on the last evening of a month.
 */
function localMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function ymdOf(year: number, month1: number, day: number): string {
  return `${year}-${String(month1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export type DayRender = {
  /** Extra classes for the day button (background/selection treatment). */
  className?: string;
  /** Decoration rendered under the day number (e.g. a dot). */
  dot?: React.ReactNode;
  /** Non-interactive + dimmed (e.g. past days in a forward-only picker). */
  disabled?: boolean;
};

/**
 * A month grid with prev/next navigation. Presentation-only: the parent decides
 * how each day looks (renderDay) and what a tap does (onDayClick), so the same
 * grid serves both the availability picker and the read-only team overview.
 */
export function MonthCalendar({
  initialMonth,
  renderDay,
  onDayClick,
  footer,
}: {
  initialMonth?: string;
  renderDay: (ymd: string, ctx: { isToday: boolean; isPast: boolean }) => DayRender;
  onDayClick?: (ymd: string) => void;
  /** Optional content rendered inside the same card, below the grid — used to
   * hang a selection/confirm panel off the calendar so it reads as one unit. */
  footer?: React.ReactNode;
}) {
  const today = new Date();
  const todayYmd = ymdOf(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const [cursor, setCursor] = useState(initialMonth ?? localMonthKey(today));
  const [year, month] = cursor.split('-').map(Number); // month is 1-based

  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();

  function shiftMonth(delta: number) {
    setCursor(localMonthKey(new Date(year, month - 1 + delta, 1)));
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

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
            const ymd = ymdOf(year, month, day);
            const isToday = ymd === todayYmd;
            const isPast = ymd < todayYmd;
            const r = renderDay(ymd, { isToday, isPast });
            return (
              <button
                key={day}
                type="button"
                disabled={r.disabled}
                onClick={() => !r.disabled && onDayClick?.(ymd)}
                className={cn(
                  'relative grid aspect-square place-items-center rounded-xl text-sm font-semibold transition',
                  r.disabled ? 'cursor-default text-ink-faint/40' : 'text-ink active:scale-95',
                  r.className,
                )}
              >
                {day}
                {r.dot}
              </button>
            );
          })}
        </div>

        {footer && <div className="mt-3 border-t border-line pt-4">{footer}</div>}
      </div>
    </div>
  );
}
