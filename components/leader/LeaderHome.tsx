'use client';

import { useState, type ComponentType, type SVGProps } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { EventDTO, AnnouncementDTO } from '@/lib/serialize';
import type { SongDTO } from '@/lib/setlist-serialize';
import type { SongSheetContext } from '@/components/shared/AudioProvider';
import type { Verse } from '@/lib/bible';
import type { ThisWeekSetlist, LeaderAlerts } from '@/lib/home-data';
import { EventRow, EventRowList } from '@/components/shared/EventCard';
import { EventDetail } from '@/components/shared/EventDetail';
import { SongDetail } from '@/components/shared/SongDetail';
import { AnnouncementBell } from '@/components/shared/AnnouncementBell';
import { AnnouncementCards } from '@/components/shared/AnnouncementCards';
import { UpNextHero } from '@/components/shared/UpNextHero';
import { VerseRibbon } from '@/components/shared/VerseRibbon';
import { InlineEmpty } from '@/components/shared/EmptyState';
import { EventForm } from '@/components/leader/EventForm';
import { AnnouncementForm } from '@/components/leader/AnnouncementForm';
import { PollsManager } from '@/components/leader/PollsManager';
import { StartCallModal } from '@/components/leader/StartCallModal';
import { ActiveCallBanner } from '@/components/call/ActiveCallBanner';
import { ProductionHomeCard } from '@/components/production/ProductionHomeCard';
import { HomeHeader, SectionHeading, WeekSetlistSection } from '@/components/shared/HomeSections';
import type { MyProductionTasks } from '@/lib/production/server';
import { Calendar, Bell, ChevronRight, Poll, Users, Phone } from '@/components/shared/Icons';

export function LeaderHome({
  name,
  events,
  announcements,
  thisWeek,
  alerts,
  verse,
  production,
}: {
  name: string;
  events: EventDTO[];
  announcements: AnnouncementDTO[];
  thisWeek: ThisWeekSetlist;
  alerts: LeaderAlerts;
  verse: Verse;
  production: MyProductionTasks;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<EventDTO | null>(null);
  const [song, setSong] = useState<{ song: SongDTO; context: SongSheetContext } | null>(null);
  const [addEvent, setAddEvent] = useState(false);
  const [addAnnouncement, setAddAnnouncement] = useState(false);
  const [addPoll, setAddPoll] = useState(false);
  const [startCall, setStartCall] = useState(false);

  const refresh = () => router.refresh();

  return (
    <div className="animate-enter-home space-y-6">
      <HomeHeader
        prefix="Leader dashboard"
        name={name}
        actions={<AnnouncementBell initial={announcements} canManage onChange={refresh} />}
      />

      <ActiveCallBanner />

      <ProductionHomeCard mine={production} base="/dashboard" />

      <VerseRibbon verse={verse} />

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setAddEvent(true)} className="btn-primary h-14">
          <Calendar width={18} height={18} /> Add Event
        </button>
        <QuickAction icon={Bell} label="Post update" onClick={() => setAddAnnouncement(true)} />
        <QuickAction icon={Poll} label="Add Poll" onClick={() => setAddPoll(true)} />
        <QuickAction icon={Phone} label="Start Call" onClick={() => setStartCall(true)} />
      </div>

      {alerts.pendingInvites > 0 && (
        <section className="space-y-3">
          <SectionHeading title="Needs your attention" />
          <Link href="/dashboard/settings" className="card row-press flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-info/[0.16] text-info-ink">
              <Users width={20} height={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="row-title block">
                {alerts.pendingInvites} pending invite{alerts.pendingInvites > 1 ? 's' : ''}
              </span>
              <span className="block text-[13px] leading-[18px] text-ink-faint">Not yet claimed. Re-invite if needed.</span>
            </span>
            <ChevronRight width={18} height={18} className="text-ink-faint" />
          </Link>
        </section>
      )}

      {/* Up next — the soonest gathering, promoted; the rest follow below. */}
      <section className="space-y-3">
        <SectionHeading
          title={events.length === 0 ? 'Upcoming · next 7 days' : 'Up next'}
          href="/dashboard/events"
          linkLabel="Manage"
        />
        {events.length === 0 ? (
          <InlineEmpty>No events this week. Tap “Add Event” to schedule one.</InlineEmpty>
        ) : (
          <UpNextHero event={events[0]} onOpen={() => setDetail(events[0])} />
        )}
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

      <WeekSetlistSection
        thisWeek={thisWeek}
        href="/dashboard/setlist"
        linkLabel="Manage"
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
          <InlineEmpty>No active announcements. Use “Post update” to share news.</InlineEmpty>
        ) : (
          <AnnouncementCards announcements={announcements} canManage onChange={refresh} />
        )}
      </section>

      <PollsManager creating={addPoll} onCreatingChange={setAddPoll} />

      {detail && <EventDetail event={detail} backLabel="Home" onClose={() => setDetail(null)} />}
      {song && <SongDetail song={song.song} context={song.context} onClose={() => setSong(null)} />}
      {addEvent && <EventForm mode="create" onClose={() => setAddEvent(false)} onSaved={() => { setAddEvent(false); refresh(); }} />}
      {addAnnouncement && <AnnouncementForm onClose={() => setAddAnnouncement(false)} onSaved={() => { setAddAnnouncement(false); refresh(); }} />}
      {startCall && <StartCallModal onClose={() => setStartCall(false)} />}
    </div>
  );
}

/** Quick-action card button (HM-2): surface, hairline, 56 tall, accent-ink icon. */
function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-3 text-[15px] font-semibold text-ink shadow-card transition duration-150 ease-soft active:scale-[0.97]"
    >
      <Icon width={18} height={18} className="text-accent-ink" /> {label}
    </button>
  );
}
