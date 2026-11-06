'use client';

import { useState } from 'react';
import type { EventDTO, AnnouncementDTO } from '@/lib/serialize';
import type { SongDTO } from '@/lib/setlist-serialize';
import type { SongSheetContext } from '@/components/shared/AudioProvider';
import type { Verse } from '@/lib/bible';
import type { ThisWeekSetlist } from '@/lib/home-data';
import { EventRow, EventRowList } from '@/components/shared/EventCard';
import { EventDetail } from '@/components/shared/EventDetail';
import { SongDetail } from '@/components/shared/SongDetail';
import { AnnouncementBell } from '@/components/shared/AnnouncementBell';
import { AnnouncementCards } from '@/components/shared/AnnouncementCards';
import { UpNextHero } from '@/components/shared/UpNextHero';
import { VerseRibbon } from '@/components/shared/VerseRibbon';
import { MemberPolls } from '@/components/member/MemberPolls';
import { EmptyState, InlineEmpty } from '@/components/shared/EmptyState';
import { ActiveCallBanner } from '@/components/call/ActiveCallBanner';
import { ProductionHomeCard } from '@/components/production/ProductionHomeCard';
import { HomeHeader, SectionHeading, WeekSetlistSection } from '@/components/shared/HomeSections';
import type { MyProductionTasks } from '@/lib/production/server';

export function MemberHome({
  name,
  events,
  announcements,
  thisWeek,
  verse,
  production,
}: {
  name: string;
  events: EventDTO[];
  announcements: AnnouncementDTO[];
  thisWeek: ThisWeekSetlist;
  verse: Verse;
  production: MyProductionTasks;
}) {
  const [detail, setDetail] = useState<EventDTO | null>(null);
  const [song, setSong] = useState<{ song: SongDTO; context: SongSheetContext } | null>(null);

  return (
    <div className="animate-enter-home space-y-6">
      <HomeHeader prefix="GNW Hub" name={name} actions={<AnnouncementBell initial={announcements} />} />

      <ActiveCallBanner />

      <ProductionHomeCard mine={production} base="/home" />

      <VerseRibbon verse={verse} />

      {/* Up next — the soonest gathering, promoted; the rest follow below. */}
      {events.length === 0 ? (
        <section className="space-y-3">
          <SectionHeading title="Upcoming · next 7 days" />
          <EmptyState message="Nothing on the calendar this week. Take a breath and rest up." verse={verse} />
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <SectionHeading title="Up next" />
            <UpNextHero event={events[0]} onOpen={() => setDetail(events[0])} />
          </section>

          {events.length > 1 && (
            <section className="space-y-3">
              <SectionHeading title="Coming up" />
              <EventRowList>
                {events.slice(1).map((e) => (
                  <EventRow key={e.id} event={e} onClick={() => setDetail(e)} />
                ))}
              </EventRowList>
            </section>
          )}
        </>
      )}

      <WeekSetlistSection
        thisWeek={thisWeek}
        href="/home/setlist"
        linkLabel="Full setlist"
        onSong={(s, i) =>
          setSong({
            song: s,
            context: { backLabel: 'Home', eyebrow: `This week · Song ${i + 1} of ${thisWeek?.songs.length ?? 0}` },
          })
        }
      />

      <section className="space-y-3">
        <SectionHeading title="Announcements" />
        {announcements.length === 0 ? (
          <InlineEmpty>You’re all caught up. No announcements right now.</InlineEmpty>
        ) : (
          <AnnouncementCards announcements={announcements} />
        )}
      </section>

      <MemberPolls />

      {detail && <EventDetail event={detail} backLabel="Home" onClose={() => setDetail(null)} />}
      {song && <SongDetail song={song.song} context={song.context} onClose={() => setSong(null)} />}
    </div>
  );
}
