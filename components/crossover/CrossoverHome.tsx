'use client';

import { useState, type ComponentType, type SVGProps } from 'react';
import Link from 'next/link';
import type { EventDTO } from '@/lib/serialize';
import { EventDetail } from '@/components/shared/EventDetail';
import { ChevronRight, Clock, Music, MusicPlus, Shirt, Video } from '@/components/shared/Icons';
import { cn } from '@/lib/utils';
import { formatTimeLabel } from '@/lib/dates';
import { CrossoverHero } from './CrossoverHero';

type Base = '/home' | '/dashboard';

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * The Crossover tab's home: the countdown hero, the Road to Crossover (every
 * season event on one line, ending at Dec 31), the next event, and a tile for
 * each Crossover section. Schedule sits below the tiles until Dec 15, then
 * moves above them — that's when the day-of times start to matter most.
 */
export function CrossoverHome({
  base,
  year,
  events,
  todayYmd,
  scheduleFirst,
  serverNow,
  summaries,
}: {
  base: Base;
  year: number;
  events: EventDTO[];
  /** Today's Eastern calendar day, "YYYY-MM-DD". */
  todayYmd: string;
  scheduleFirst: boolean;
  serverNow: number;
  /** One line of live detail per section tile, e.g. "3 sets · 17 min". */
  summaries: { sets: string; attire: string; suggestions: string; schedule: string };
}) {
  const [detail, setDetail] = useState<EventDTO | null>(null);
  const next = events.find((e) => e.date.slice(0, 10) >= todayYmd) ?? null;

  const schedule = (
    <SectionCard href={`${base}/crossover/schedule`} icon={Clock} title="Schedule" meta={summaries.schedule} wide />
  );

  return (
    <div className="animate-enter-home space-y-6 pb-2 pt-2">
      <header className="pr-12">
        <div className="eyebrow">GNW Hub</div>
        <h1 className="page-title mt-2">Crossover</h1>
      </header>

      <CrossoverHero year={year} serverNow={serverNow} />

      <section className="space-y-3" aria-label="Road to Crossover">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-semibold">Road to Crossover</h2>
          <Link
            href={`${base}/crossover/calendar`}
            className="row-press inline-flex items-center gap-0.5 rounded-lg text-sm font-semibold text-crossover-gold-ink dark:text-crossover-gold"
          >
            Calendar <ChevronRight width={16} height={16} />
          </Link>
        </div>
        <Road events={events} todayYmd={todayYmd} nextId={next?.id ?? null} />
        {next && (
          <button
            type="button"
            onClick={() => setDetail(next)}
            className="card row-press flex w-full items-center gap-3.5 p-3.5 text-left"
          >
            <span className="grid h-[50px] w-[46px] shrink-0 place-items-center rounded-2xl bg-crossover-ever text-crossover-gold-hi">
              <span className="text-center leading-tight">
                <span className="block text-[10px] font-bold tracking-wider text-crossover-champagne/80">
                  {new Date(next.date).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase()}
                </span>
                <span className="block text-[19px] font-bold">{new Date(next.date).getUTCDate()}</span>
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="label block">{next.date.slice(0, 10) === todayYmd ? 'Today' : 'Up next'}</span>
              <span className="mt-0.5 block truncate font-semibold text-ink">{next.eventName}</span>
              <span className="block truncate text-sm text-ink-soft">
                {formatTimeLabel(next.time)} · {next.location}
              </span>
            </span>
            <ChevronRight width={18} height={18} className="shrink-0 text-ink-faint" />
          </button>
        )}
      </section>

      <section className="space-y-2.5" aria-label="Crossover sections">
        {scheduleFirst && schedule}
        <div className="grid grid-cols-2 gap-2.5">
          <SectionCard href={`${base}/crossover/sets`} icon={Music} title="Sets" meta={summaries.sets} />
          <SectionCard href={`${base}/crossover/attire`} icon={Shirt} title="Attire" meta={summaries.attire} />
          <SectionCard
            href={`${base}/crossover/suggestions`}
            icon={MusicPlus}
            title="Suggestions"
            meta={summaries.suggestions}
          />
          <SectionCard
            href={`${base}/crossover/production`}
            icon={Video}
            title="Production"
            meta="Stage map and setup"
            muted
            soon="Coming later"
          />
        </div>
        {!scheduleFirst && schedule}
      </section>

      {detail && <EventDetail event={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

/** One section tile (or the full-width Schedule card). `soon` marks a section that isn't built yet. */
function SectionCard({
  href,
  icon: Icon,
  title,
  meta,
  wide,
  muted,
  soon,
}: {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  meta: string;
  wide?: boolean;
  muted?: boolean;
  soon?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'row-press flex rounded-3xl border border-line p-3.5',
        muted ? 'bg-transparent' : 'bg-surface shadow-card',
        wide ? 'items-center gap-3.5' : 'min-h-[9.5rem] flex-col',
      )}
    >
      <span
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
          muted ? 'bg-surface-2 text-ink-soft' : 'bg-crossover-ever text-crossover-gold-hi',
        )}
      >
        <Icon width={19} height={19} />
      </span>
      <span className={cn('min-w-0', wide ? 'flex-1' : 'mt-2.5 flex flex-1 flex-col')}>
        <span className={cn('block font-display text-lg font-semibold', muted && 'text-ink-soft')}>{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">{meta}</span>
        {!wide && soon && (
          <span className="mt-auto pt-2.5">
            <span className="chip bg-surface-2 text-ink-soft">{soon}</span>
          </span>
        )}
      </span>
      {wide && soon && <span className="chip shrink-0 bg-surface-2 text-ink-soft">{soon}</span>}
      {!soon && <ChevronRight width={18} height={18} className={cn('shrink-0 text-ink-faint', !wide && 'hidden')} />}
    </Link>
  );
}

/**
 * Every season event as a stop on one horizontal line. Past stops fill in, the
 * next one glows, and Crossover itself is the gold star at the end.
 */
function Road({ events, todayYmd, nextId }: { events: EventDTO[]; todayYmd: string; nextId: string | null }) {
  if (events.length === 0) return null;
  return (
    // scroll-px keeps snapping from pulling the first stop flush to the screen
    // edge; the extra top/left room keeps the next stop's glow from clipping.
    <ol className="no-scrollbar -mx-5 flex snap-x scroll-px-5 overflow-x-auto px-5 pb-1 pt-2">
      {events.map((e, i) => {
        const done = e.date.slice(0, 10) < todayYmd;
        const isNext = e.id === nextId;
        const isEnd = e.crossoverKind === 'crossover';
        return (
          <li key={e.id} className="relative w-[5.5rem] shrink-0 snap-start pr-2">
            {/* the line into the next stop */}
            {i < events.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'absolute left-2 right-0 top-[7px] h-0.5',
                  done ? 'bg-crossover-ever/50 dark:bg-crossover-ever' : 'bg-line',
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                'relative grid h-4 w-4 place-items-center rounded-full',
                isEnd
                  ? 'text-crossover-gold'
                  : done
                    ? 'bg-crossover-ever'
                    : isNext
                      ? 'border-2 border-crossover-gold bg-app shadow-[0_0_0_5px_rgb(201_155_69/0.18)]'
                      : 'border-2 border-line bg-app',
              )}
            >
              {isEnd ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2l2.6 6.9L22 11.5l-7.4 2.6L12 21l-2.6-6.9L2 11.5l7.4-2.6z" />
                </svg>
              ) : (
                isNext && <span className="h-2 w-2 rounded-full bg-crossover-gold" />
              )}
            </span>
            <span
              className={cn(
                'mt-1.5 block text-[12.5px] font-bold tabular-nums',
                done && 'opacity-60',
                isNext && 'text-crossover-gold-ink dark:text-crossover-gold',
                isEnd && 'text-crossover-gold-ink dark:text-crossover-gold',
              )}
            >
              {shortDate(e.date)}
            </span>
            <span className={cn('mt-0.5 line-clamp-2 block text-[11.5px] leading-snug text-ink-soft', done && 'opacity-60')}>
              {e.eventName}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
