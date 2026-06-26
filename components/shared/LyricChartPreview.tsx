'use client';

import type { LyricChart } from '@/lib/setlist-serialize';
import { cn } from '@/lib/utils';

/** Short "2 hours ago" style relative time for the import stamp. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Renders a parsed lyric chart: section labels as small all-caps accent markers,
 * lyric lines as body text, blanks as spacers. Scrolls within a capped height so
 * long charts don't blow out the surrounding panel.
 *
 * `bare` drops the meta header (used in the full-screen read view where the song
 * title already heads the screen).
 */
export function LyricChartPreview({
  chart,
  className,
  bare = false,
}: {
  chart: LyricChart;
  className?: string;
  bare?: boolean;
}) {
  return (
    <div className={className}>
      {!bare && (
        <div className="mb-2 space-y-0.5">
          <p className="text-xs text-ink-faint">Imported from: {chart.title}</p>
          {chart.parsedAt && (
            <p className="text-xs text-ink-faint">Last imported: {relativeTime(chart.parsedAt)}</p>
          )}
        </div>
      )}
      <div className={cn('leading-relaxed', !bare && 'max-h-96 overflow-y-auto')}>
        {chart.lines.map((line, i) => {
          if (line.type === 'blank') return <div key={i} style={{ height: '0.75rem' }} aria-hidden />;
          if (line.type === 'section') {
            return (
              <p
                key={i}
                className="mb-1 mt-3 text-xs font-bold uppercase tracking-[0.1em] text-accent-ink first:mt-0 dark:text-accent-on"
              >
                {line.text}
              </p>
            );
          }
          return (
            <p key={i} className="text-ink">
              {line.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
