'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { EventDTO, AnnouncementDTO } from '@/lib/serialize';
import type { SongDTO } from '@/lib/setlist-serialize';
import type { Verse } from '@/lib/bible';
import type { ThisWeekSetlist } from '@/lib/home-data';
import { EventCard } from '@/components/shared/EventCard';
import { EventDetail } from '@/components/shared/EventDetail';
import { SongDetail } from '@/components/shared/SongDetail';
import { AnnouncementBell } from '@/components/shared/AnnouncementBell';
import { AnnouncementCards } from '@/components/shared/AnnouncementCards';
import { UpNextHero } from '@/components/shared/UpNextHero';
import { VerseRibbon } from '@/components/shared/VerseRibbon';
import { MemberPolls } from '@/components/member/MemberPolls';
import { EmptyState } from '@/components/shared/EmptyState';
import { Music, ChevronRight } from '@/components/shared/Icons';

export function MemberHome({
  name,
  events,
  announcements,
  thisWeek,
  verse,
}: {
  name: string;
  events: EventDTO[];
  announcements: AnnouncementDTO[];
  thisWeek: ThisWeekSetlist;
  verse: Verse;
}) {
  const [detail, setDetail] = useState<EventDTO | null>(null);
  const [song, setSong] = useState<SongDTO | null>(null);
  const firstName = name.split(' ')[0] || name;

  return (
    <div className="animate-enter-home space-y-6 pt-2">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">GNW Hub</div>
          <h1 className="page-title mt-2">Shalom, {firstName}</h1>
        </div>
        <AnnouncementBell initial={announcements} />
      </header>

      <VerseRibbon verse={verse} />

      {/* Up next — the soonest gathering, promoted; the rest follow below. */}
      {events.length === 0 ? (
        <section className="space-y-3">
          <h2 className="eyebrow">Upcoming · next 7 days</h2>
          <EmptyState message="Nothing on the calendar this week. Take a breath and rest up." verse={verse} />
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="eyebrow">Up next</h2>
            <UpNextHero event={events[0]} onOpen={() => setDetail(events[0])} />
          </section>

          {events.length > 1 && (
            <section className="space-y-3">
              <h2 className="eyebrow">Coming up</h2>
              {events.slice(1).map((e) => (
                <EventCard key={e.id} event={e} onClick={() => setDetail(e)} />
              ))}
            </section>
          )}
        </>
      )}

      {/* This Week's Setlist */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">This week’s setlist</h2>
          <Link href="/home/setlist" className="text-sm font-semibold text-accent-ink dark:text-accent-on">
            Full setlist →
          </Link>
        </div>
        {thisWeek && thisWeek.songs.length > 0 ? (
          <div className="card overflow-hidden">
            {thisWeek.songs.map((s, i) => {
              const parts = [s.audioSoprano, s.audioAlto, s.audioTenor, s.audioAllParts].filter(Boolean).length;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSong(s)}
                  className="row-press flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-0"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-sm font-bold text-accent-ink">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{s.songTitle}</span>
                    <span className="flex items-center gap-1 truncate text-xs text-ink-faint">
                      <Music width={12} height={12} />{' '}
                      {s.artist ? s.artist : parts > 0 ? `${parts} part${parts > 1 ? 's' : ''}` : 'Audio soon'}
                    </span>
                  </span>
                  <ChevronRight width={18} height={18} className="text-ink-faint" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="card p-5 text-center text-sm text-ink-faint">No songs tied to this week’s events yet.</div>
        )}
      </section>

      {/* Announcements */}
      <section className="space-y-3 pb-2">
        <h2 className="eyebrow">Announcements</h2>
        {announcements.length === 0 ? (
          <div className="card p-5 text-center text-sm text-ink-faint">You’re all caught up — no announcements right now.</div>
        ) : (
          <AnnouncementCards announcements={announcements} />
        )}
      </section>

      {/* Polls */}
      <MemberPolls />

      {detail && <EventDetail event={detail} onClose={() => setDetail(null)} />}
      {song && <SongDetail song={song} onClose={() => setSong(null)} />}
    </div>
  );
}
