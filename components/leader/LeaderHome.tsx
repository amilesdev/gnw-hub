'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { EventDTO, AnnouncementDTO } from '@/lib/serialize';
import type { SongDTO } from '@/lib/setlist-serialize';
import type { ThisWeekSetlist, LeaderAlerts } from '@/lib/home-data';
import { EventCard } from '@/components/shared/EventCard';
import { EventDetail } from '@/components/shared/EventDetail';
import { SongDetail } from '@/components/shared/SongDetail';
import { AnnouncementBell } from '@/components/shared/AnnouncementBell';
import { AnnouncementCards } from '@/components/shared/AnnouncementCards';
import { EventForm } from '@/components/leader/EventForm';
import { AnnouncementForm } from '@/components/leader/AnnouncementForm';
import { Calendar, Bell, Music, ChevronRight, Plus, Sparkle, Upload, Clock, Users } from '@/components/shared/Icons';

export function LeaderHome({
  name,
  events,
  announcements,
  thisWeek,
  alerts,
}: {
  name: string;
  events: EventDTO[];
  announcements: AnnouncementDTO[];
  thisWeek: ThisWeekSetlist;
  alerts: LeaderAlerts;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<EventDTO | null>(null);
  const [song, setSong] = useState<SongDTO | null>(null);
  const [addEvent, setAddEvent] = useState(false);
  const [addAnnouncement, setAddAnnouncement] = useState(false);
  const firstName = name.split(' ')[0] || name;

  const refresh = () => router.refresh();
  const hasAlerts = alerts.unfilledAudioSlots > 0 || alerts.expiringSoon > 0 || alerts.pendingInvites > 0;

  return (
    <div className="animate-enter-home space-y-6 pt-2">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Leader dashboard</div>
          <h1 className="page-title mt-2">Shalom, {firstName}</h1>
        </div>
        <AnnouncementBell initial={announcements} canManage onChange={refresh} />
      </header>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setAddEvent(true)} className="btn-primary !rounded-3xl px-4 py-4">
          <Calendar width={18} height={18} /> Add Event
        </button>
        <button
          type="button"
          onClick={() => setAddAnnouncement(true)}
          className="row-press inline-flex items-center justify-center gap-2 rounded-3xl border border-line bg-surface px-4 py-4 font-semibold text-ink shadow-card"
        >
          <Bell width={18} height={18} className="text-accent" /> Post Update
        </button>
      </div>

      {/* Alerts */}
      {hasAlerts && (
        <section className="space-y-3">
          <h2 className="eyebrow inline-flex items-center gap-1.5">
            <Sparkle width={14} height={14} className="text-warn" /> Needs your attention
          </h2>
          <div className="space-y-2.5">
            {alerts.unfilledAudioSlots > 0 && (
              <AlertRow
                href="/dashboard/setlist"
                icon={<Upload width={18} height={18} />}
                tone="warn"
                title={`${alerts.unfilledAudioSlots} audio slot${alerts.unfilledAudioSlots > 1 ? 's' : ''} unfilled`}
                sub={`Across ${alerts.unfilledSongs} song${alerts.unfilledSongs > 1 ? 's' : ''} in this week’s setlist`}
              />
            )}
            {alerts.expiringSoon > 0 && (
              <AlertRow
                href="/dashboard"
                icon={<Clock width={18} height={18} />}
                tone="warn"
                title={`${alerts.expiringSoon} announcement${alerts.expiringSoon > 1 ? 's' : ''} expiring soon`}
                sub="Expires within 24 hours — open the bell to extend"
              />
            )}
            {alerts.pendingInvites > 0 && (
              <AlertRow
                href="/dashboard/members"
                icon={<Users width={18} height={18} />}
                tone="info"
                title={`${alerts.pendingInvites} pending invite${alerts.pendingInvites > 1 ? 's' : ''}`}
                sub="Not yet claimed — re-invite if needed"
              />
            )}
          </div>
        </section>
      )}

      {/* Upcoming Events */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">Upcoming · next 7 days</h2>
          <Link href="/dashboard/events" className="text-sm font-semibold text-accent-ink dark:text-accent-on">
            Manage →
          </Link>
        </div>
        {events.length === 0 ? (
          <div className="card p-5 text-center text-sm text-ink-faint">No events this week. Tap “Add Event” to schedule one.</div>
        ) : (
          events.map((e) => <EventCard key={e.id} event={e} onClick={() => setDetail(e)} />)
        )}
      </section>

      {/* This Week's Setlist */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">This week’s setlist</h2>
          <Link href="/dashboard/setlist" className="text-sm font-semibold text-accent-ink dark:text-accent-on">
            Manage →
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
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-sm font-bold text-accent-ink">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{s.songTitle}</span>
                    <span className="flex items-center gap-1 truncate text-xs text-ink-faint">
                      <Music width={12} height={12} /> {s.artist ? s.artist : `${parts}/4 parts uploaded`}
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
          <div className="card p-5 text-center text-sm text-ink-faint">No active announcements. Use “Post Update” to share news.</div>
        ) : (
          <AnnouncementCards announcements={announcements} />
        )}
      </section>

      {detail && <EventDetail event={detail} onClose={() => setDetail(null)} />}
      {song && <SongDetail song={song} onClose={() => setSong(null)} />}
      {addEvent && <EventForm mode="create" onClose={() => setAddEvent(false)} onSaved={() => { setAddEvent(false); refresh(); }} />}
      {addAnnouncement && <AnnouncementForm onClose={() => setAddAnnouncement(false)} onSaved={() => { setAddAnnouncement(false); refresh(); }} />}
    </div>
  );
}

function AlertRow({
  href,
  icon,
  title,
  sub,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
  tone: 'warn' | 'info';
}) {
  const toneClass = tone === 'warn' ? 'bg-warn/15 text-[#8F5E1C] dark:text-[#E0A75E]' : 'bg-info/15 text-info';
  return (
    <Link href={href} className="card row-press flex items-center gap-3 p-4">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${toneClass}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-ink-faint">{sub}</span>
      </span>
      <ChevronRight width={18} height={18} className="text-ink-faint" />
    </Link>
  );
}
