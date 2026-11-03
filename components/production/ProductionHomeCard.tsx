import Link from 'next/link';
import { ChevronRight, Check } from '@/components/shared/Icons';
import { formatEventDate } from '@/lib/dates';
import type { MyProductionTasks } from '@/lib/production/server';

/** Home card: "You're on production" for the next service or Encounter Night this week. Only shown to owners. */
export function ProductionHomeCard({ mine, base }: { mine: MyProductionTasks; base: '/home' | '/dashboard' }) {
  if (!mine) return null;
  const allDone = mine.done === mine.total;
  return (
    <Link href={`${base}/production?event=${mine.event.id}&tab=checklist`} className="card row-press flex items-center gap-3 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent-ink dark:text-accent-on">
        {allDone ? <Check width={20} height={20} /> : <span className="font-display text-lg font-semibold tabular-nums">{mine.total - mine.done}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="eyebrow block">Your production tasks</span>
        <span className="block truncate font-semibold">
          {allDone ? 'All done. Thank you!' : mine.titles.length === 1 ? mine.titles[0] : `${mine.titles[0]} + ${mine.titles.length - 1} more`}
        </span>
        <span className="block text-xs text-ink-faint">
          {mine.event.eventName} · {formatEventDate(new Date(mine.event.date))} · {mine.done} of {mine.total} done
        </span>
      </span>
      <ChevronRight width={20} height={20} className="shrink-0 text-ink-faint" />
    </Link>
  );
}
