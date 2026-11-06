'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { SongDTO } from '@/lib/setlist-serialize';
import type { ThisWeekSetlist } from '@/lib/home-data';
import { SongLeadFaces } from './SongLeads';
import { InlineEmpty } from './EmptyState';
import { ScreenHeader, headerDate } from './ScreenHeader';
import { Music, ChevronRight } from './Icons';
import { cn } from '@/lib/utils';
import { listCard } from '@/lib/ui-classes';

export { listCard };

/** Home header (HM-1/2): "{prefix} · {Mon, Nov 2}", "Shalom, *{first}*". */
export function HomeHeader({ prefix, name, actions }: { prefix: string; name: string; actions?: ReactNode }) {
  const firstName = name.trim().split(/\s+/)[0] || name;
  return (
    <ScreenHeader
      className="mb-0"
      // The date is "today" in Eastern time; the server and phone can straddle
      // midnight for a moment, which is fine to repaint.
      eyebrow={<span suppressHydrationWarning>{`${prefix} · ${headerDate()}`}</span>}
      title={
        <>
          Shalom, <em className="font-medium">{firstName}</em>
        </>
      }
      actions={actions}
    />
  );
}

/** Section heading (Literata title) with an optional "Label →" link. */
export function SectionHeading({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="t-title">{title}</h2>
      {href && (
        <Link href={href} className="link-arrow shrink-0">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

function partsCount(s: SongDTO) {
  return [s.audioSoprano, s.audioAlto, s.audioTenor, s.audioAllParts].filter(Boolean).length;
}

/** Song row (CMP-11): bare Literata index, title, "{n} parts", lead faces, chevron. */
export function SongRow({ song, index, onClick }: { song: SongDTO; index: number; onClick: () => void }) {
  const parts = partsCount(song);
  return (
    <button type="button" onClick={onClick} className="row-press flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left">
      <span className="numeral-sm w-[22px] shrink-0 text-center text-accent-ink">{index + 1}</span>
      <span className="min-w-0 flex-1">
        <span className="row-title block truncate">{song.songTitle}</span>
        <span className="flex items-center gap-1 truncate text-[13px] leading-[18px] text-ink-soft">
          <Music width={12} height={12} className="shrink-0" aria-hidden />
          <span className="truncate">
            {song.artist ? song.artist : parts > 0 ? `${parts} part${parts > 1 ? 's' : ''}` : 'Audio coming soon'}
          </span>
        </span>
      </span>
      <SongLeadFaces leads={song.leads} />
      <ChevronRight width={18} height={18} className="shrink-0 text-ink-faint" aria-hidden />
    </button>
  );
}

const MAX_HOME_SONGS = 6;

/** "This week's setlist" on Home: up to 6 songs, then "+{n} more songs". */
export function WeekSetlistSection({
  thisWeek,
  href,
  linkLabel,
  onSong,
}: {
  thisWeek: ThisWeekSetlist;
  href: string;
  linkLabel: string;
  onSong: (song: SongDTO, index: number) => void;
}) {
  const songs = thisWeek?.songs ?? [];
  const extra = songs.length - MAX_HOME_SONGS;
  return (
    <section className="space-y-3">
      <SectionHeading title="This week’s setlist" href={href} linkLabel={linkLabel} />
      {songs.length > 0 ? (
        <div className={cn(listCard, 'animate-rise')}>
          {songs.slice(0, MAX_HOME_SONGS).map((s, i) => (
            <SongRow key={s.id} song={s} index={i} onClick={() => onSong(s, i)} />
          ))}
          {extra > 0 && (
            <Link href={href} className="row-press flex min-h-12 items-center px-4 text-sm font-semibold text-accent-ink">
              +{extra} more song{extra > 1 ? 's' : ''}
            </Link>
          )}
        </div>
      ) : (
        <InlineEmpty>No songs tied to this week’s events yet.</InlineEmpty>
      )}
    </section>
  );
}
