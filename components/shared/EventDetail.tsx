'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { EventDTO, PrayerRequestDTO } from '@/lib/serialize';
import type { SetlistDTO, SongDTO } from '@/lib/setlist-serialize';
import { Overlay } from './Overlay';
import { ScriptureSheet } from './ScriptureSheet';
import { SongDetail } from './SongDetail';
import { SongRow } from './HomeSections';
import { EventBadge } from './EventTypeBadge';
import { EventActions } from './EventActions';
import { hasAttire, eventAssignments, VOCAL_PARTS } from './EventCard';
import { Skeleton } from './Skeleton';
import { useToast } from './Toast';
import type { SongSheetContext } from './AudioProvider';
import { Calendar, Clock, MapPin, Shirt, Book, Music, Mic, Pray, Trash, ChevronRight, X, MoreHorizontal } from './Icons';
import { apiFetch } from '@/lib/api-client';
import { listCard } from '@/lib/ui-classes';
import { useDataChanged } from '@/lib/data-changed';
import { formatEventDate, formatTimeLabel } from '@/lib/dates';
import { resolveScheduleLabel } from '@/lib/rehearsal-schedule';

/** Info row (CMP-11): 36px icon chip + 16/22 text, min 56 tall. */
function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 py-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-soft">{icon}</span>
      <span className="text-base leading-[22px] text-ink">{children}</span>
    </div>
  );
}

/** Section card heading (EV-3): a 16px accent icon + an ink eyebrow. */
function SectionTitle({ icon: Icon, children }: { icon: React.ComponentType<{ width?: number; height?: number }>; children: React.ReactNode }) {
  return (
    <p className="eyebrow inline-flex items-center gap-1.5 text-ink">
      <span className="text-accent-ink">
        <Icon width={16} height={16} />
      </span>
      {children}
    </p>
  );
}

function ColorSwatch({ label, name, hex }: { label: string; name?: string | null; hex?: string | null }) {
  if (!name && !hex) return null;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className="grid h-14 w-14 place-items-center rounded-[18px] border border-line text-ink-faint shadow-card"
        style={hex ? { background: hex } : undefined}
        aria-hidden
      >
        {!hex && <Shirt width={18} height={18} />}
      </span>
      <span className="label">{label}</span>
      {name && <span className="text-[13px] font-semibold text-ink-soft">{name}</span>}
      {hex && <span className="text-[11px] font-semibold uppercase text-ink-faint">{hex}</span>}
    </div>
  );
}

/**
 * Prayer-event-only section. Anyone signed in (member or leader) can add a
 * request; all are shown to everyone as one ongoing, table-style list. Topped
 * by the Mark 11:24 promise in the serif display face to set it apart.
 */
function PrayerRequests({ eventId }: { eventId: string }) {
  const { data: session } = useSession();
  const me = session?.user;
  const [requests, setRequests] = useState<PrayerRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    let active = true;
    apiFetch<{ prayerRequests: PrayerRequestDTO[] }>(`/api/events/${eventId}/prayer-requests`)
      .then(({ prayerRequests }) => {
        if (active) setRequests(prayerRequests);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      const { prayerRequest } = await apiFetch<{ prayerRequest: PrayerRequestDTO }>(
        `/api/events/${eventId}/prayer-requests`,
        { method: 'POST', body: JSON.stringify({ body }) },
      );
      setRequests((prev) => [...prev, prayerRequest]);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add your request.');
    } finally {
      setBusy(false);
    }
  }

  // Gone at once; the delete is sent when the undo toast closes (CMP-22).
  function remove(id: string) {
    const index = requests.findIndex((x) => x.id === id);
    const removed = requests[index];
    if (!removed) return;
    const restore = () =>
      setRequests((r) => (r.some((x) => x.id === id) ? r : [...r.slice(0, index), removed, ...r.slice(index)]));
    setRequests((r) => r.filter((x) => x.id !== id));
    toast.show({
      message: 'Request deleted.',
      undo: restore,
      commit: () => apiFetch(`/api/events/${eventId}/prayer-requests/${id}`, { method: 'DELETE' }).catch(restore),
    });
  }

  return (
    <section className="card grain-block space-y-4 p-4">
      <SectionTitle icon={Pray}>Prayer requests</SectionTitle>

      <figure className="grain-block overflow-hidden rounded-2xl bg-accent px-4 py-4 text-center text-accent-fg shadow-pop">
        <blockquote className="font-display text-[15px] italic leading-snug text-accent-fg">
          “Therefore, I tell you, whatever you ask in prayer, believe that you have received it, and it
          will be yours.”
        </blockquote>
        <figcaption className="eyebrow relative mt-2 text-accent-fg/70">
          Mark 11:24
        </figcaption>
      </figure>

      {loading && (
        <div className="space-y-2" role="status" aria-label="Loading">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      )}

      {!loading && requests.length > 0 && (
        <ul className="rounded-2xl bg-surface-2 px-4 py-1.5">
          {requests.map((r) => {
            const canDelete = me && (me.id === r.authorId || me.role === 'leader');
            return (
              <li
                key={r.id}
                className="flex items-end gap-3 border-b border-line py-3 leading-relaxed last:border-b-0"
              >
                <p className="selectable min-w-0 flex-1 whitespace-pre-wrap text-[15px] text-ink">{r.body}</p>
                <span className="shrink-0 text-[13px] font-semibold text-ink-faint">
                  {r.authorName}
                </span>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    aria-label="Remove prayer request"
                    className="btn-icon -my-2 -mr-3 shrink-0 text-ink-faint"
                  >
                    <Trash width={16} height={16} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!loading && requests.length === 0 && (
        <p className="py-1 text-center text-sm text-ink-faint">
          No requests yet. Be the first to share one.
        </p>
      )}

      <form onSubmit={add} className="space-y-2">
        <textarea
          className="field min-h-[52px] py-3.5"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Share a prayer request for the team…"
          maxLength={2000}
        />
        {error && <p role="alert" className="text-[13px] font-semibold text-bad-ink">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy || !draft.trim()}>
          {busy ? 'Sharing…' : 'Add prayer request'}
        </button>
      </form>
    </section>
  );
}

/**
 * Event detail (EV-3). Leaders (`onEdit`) get a More menu in the header for
 * Edit / Delete, in place of the old buttons under each card. `backLabel` names
 * the screen it opened from ("Events", "Home").
 */
export function EventDetail({
  event,
  onClose,
  backLabel = 'Back',
  onEdit,
  onDeleted,
}: {
  event: EventDTO;
  onClose: () => void;
  backLabel?: string;
  onEdit?: (e: EventDTO) => void;
  onDeleted?: () => void;
}) {
  const { data: session } = useSession();
  const myId = session?.user?.id;
  const [setlist, setSetlist] = useState<SetlistDTO | null>(null);
  const [setlistLoading, setSetlistLoading] = useState(Boolean(event.setlistId));
  const [song, setSong] = useState<{ song: SongDTO; context: SongSheetContext } | null>(null);
  const [more, setMore] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [openScripture, setOpenScripture] = useState<string | null>(null);
  const isHolyTalks = event.type === 'holy_talks';
  const isPrayer = event.type === 'prayer';
  const isRehearsal = event.type === 'rehearsal';
  // Production (stage map + setup checklist) lives on Service, Encounter Night and Other events.
  // Crossover events get their own production later (on the Crossover tab), not this one.
  const hasProduction =
    !event.crossoverKind && (event.type === 'service' || event.type === 'encounter_night' || event.type === 'other');
  const productionBase = usePathname().startsWith('/dashboard') ? '/dashboard' : '/home';
  // Singing, by part (S/A/T), with the viewer marked "(you)".
  const singing = VOCAL_PARTS.map((part) => ({
    part,
    people: eventAssignments(event).filter((a) => a.part === part),
  })).filter((g) => g.people.length > 0);
  // Song-review rows resolve their title from the currently-attached setlist, so
  // a saved schedule stays in step with setlist changes.
  const setlistTitles = setlist ? setlist.songs.map((s) => s.songTitle) : [];

  // Re-pull the setlist when it may have changed (a save, or a newer cached copy).
  const [setlistVersion, setSetlistVersion] = useState(0);
  useDataChanged(() => setSetlistVersion((n) => n + 1));

  // Pull in the setlist tied to this event (if any) so it lives on the card.
  useEffect(() => {
    let active = true;
    apiFetch<{ setlists: SetlistDTO[] }>(`/api/setlists?eventId=${event.id}`)
      .then(({ setlists }) => {
        if (active) setSetlist(setlists.find((s) => s.songs.length > 0) ?? null);
      })
      .catch(() => {})
      .finally(() => active && setSetlistLoading(false));
    return () => {
      active = false;
    };
  }, [event.id, setlistVersion]);

  return (
    <Overlay
      title={event.eventName}
      onClose={onClose}
      backLabel={backLabel}
      action={
        <div className="flex items-center gap-1">
          <EventBadge event={event} />
          {onEdit && (
            <button type="button" onClick={() => setMore(true)} className="btn-icon -mr-2" aria-label={`More for ${event.eventName}`}>
              <MoreHorizontal width={20} height={20} />
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        <section className="card divide-y divide-line px-4">
          <InfoRow icon={<Calendar width={18} height={18} />}>{formatEventDate(new Date(event.date))}</InfoRow>
          {event.time && <InfoRow icon={<Clock width={18} height={18} />}>{formatTimeLabel(event.time)}</InfoRow>}
          {event.location && <InfoRow icon={<MapPin width={18} height={18} />}>{event.location}</InfoRow>}
        </section>

        {hasProduction && (
          <Link
            href={`${productionBase}/production?event=${event.id}&tab=${event.type === 'other' ? 'checklist' : 'map'}`}
            className="card row-press flex min-h-[68px] items-center gap-3 p-4"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">
              <Mic width={18} height={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="row-title block">Production</span>
              <span className="block text-sm text-ink-faint">{event.type === 'other' ? 'Setup checklist' : 'Stage map and setup checklist'}</span>
            </span>
            <ChevronRight width={18} height={18} className="text-ink-faint" />
          </Link>
        )}

        {setlistLoading ? (
          <section className="space-y-3" role="status" aria-label="Loading setlist">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-48 w-full rounded-3xl" />
          </section>
        ) : (
          setlist &&
          setlist.songs.length > 0 && (
            <section className="space-y-3">
              <SectionTitle icon={Music}>
                Setlist · {setlist.songs.length} song{setlist.songs.length === 1 ? '' : 's'}
              </SectionTitle>
              <div className={listCard}>
                {setlist.songs.map((s, i) => (
                  <div key={s.id} className="animate-rise" style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}>
                    <SongRow
                      song={s}
                      index={i}
                      onClick={() =>
                        setSong({
                          song: s,
                          context: { backLabel: 'Event', eyebrow: `${event.eventName} · Song ${i + 1} of ${setlist.songs.length}` },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </section>
          )
        )}

        {isRehearsal && event.rehearsalSchedule.length > 0 && (
          <section className="card p-4">
            <SectionTitle icon={Clock}>Schedule</SectionTitle>
            <ul className="mt-1 divide-y divide-line">
              {event.rehearsalSchedule.map((item, i) => (
                <li key={i} className="flex items-baseline gap-4 py-3">
                  <span className="w-20 shrink-0 font-display text-[15px] font-semibold tabular-nums text-accent-ink">
                    {item.time ? formatTimeLabel(item.time) : '—'}
                  </span>
                  <span className="min-w-0 flex-1 whitespace-pre-wrap text-[15px] leading-[22px] text-ink">
                    {resolveScheduleLabel(item, setlistTitles)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {event.notes && (
          <section className="card p-4">
            <p className="eyebrow mb-2 text-ink">Notes</p>
            <p className="selectable whitespace-pre-wrap text-ink-soft">{event.notes}</p>
          </section>
        )}

        {isPrayer && <PrayerRequests eventId={event.id} />}

        {isHolyTalks && (event.topic || event.scriptures.length > 0 || event.holyTalksNotes) && (
          <section className="card p-4">
            <div className="mb-3">
              <SectionTitle icon={Book}>Holy Talks</SectionTitle>
            </div>
            {event.topic && (
              <div className="mb-3">
                <p className="label mb-1">Topic</p>
                <p className="font-display text-lg font-semibold">{event.topic}</p>
              </div>
            )}
            {event.scriptures.length > 0 && (
              <div className="mb-3">
                <p className="label mb-1.5">Scriptures</p>
                <ul className="flex flex-wrap gap-1.5">
                  {event.scriptures.map((s, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => setOpenScripture(s)}
                        className="chip bg-accent-soft text-accent-ink transition-transform duration-150 active:scale-95"
                        aria-label={`Read ${s}`}
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {event.holyTalksNotes && (
              <div>
                <p className="label mb-1">Notes</p>
                <p className="selectable whitespace-pre-wrap text-ink-soft">{event.holyTalksNotes}</p>
              </div>
            )}
          </section>
        )}

        {singing.length > 0 && (
          <section className="card space-y-3 p-4">
            <SectionTitle icon={Mic}>Singing</SectionTitle>
            <div className="space-y-2">
              {singing.map(({ part, people }) => (
                <div key={part} className="flex items-baseline gap-3">
                  <span className="w-[72px] shrink-0 text-sm font-bold text-ink-soft">{part}</span>
                  <p className="min-w-0 flex-1 text-[15px] leading-[22px] text-ink">
                    {people.map((a, i) => (
                      <span key={a.userId}>
                        {i > 0 && ', '}
                        {a.name}
                        {a.userId === myId && <span className="font-semibold text-accent-ink"> (you)</span>}
                      </span>
                    ))}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {hasAttire(event) && (
          <section className="card grain-block space-y-4 p-4">
            <SectionTitle icon={Shirt}>What to wear</SectionTitle>

            {(event.attirePrimary || event.attireSecondary || event.attireComplement ||
              event.attirePrimaryHex || event.attireSecondaryHex || event.attireComplementHex) && (
              <div className="flex flex-wrap items-start justify-center gap-5 rounded-2xl bg-surface-2 px-4 py-5">
                <ColorSwatch label="Primary" name={event.attirePrimary} hex={event.attirePrimaryHex} />
                <ColorSwatch label="Secondary" name={event.attireSecondary} hex={event.attireSecondaryHex} />
                <ColorSwatch label="Tertiary" name={event.attireComplement} hex={event.attireComplementHex} />
              </div>
            )}

            {event.attireNotes && (
              <div>
                <p className="label mb-1">Notes</p>
                <p className="selectable whitespace-pre-wrap text-ink-soft">{event.attireNotes}</p>
              </div>
            )}

            {event.attirePhotos.length > 0 && (
              <div>
                <p className="label mb-2">Gallery</p>
                <div className="grid grid-cols-3 gap-2">
                  {event.attirePhotos.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={src}
                      src={src}
                      alt="Attire reference"
                      onClick={() => setLightbox(src)}
                      className="aspect-square w-full cursor-zoom-in rounded-[18px] border border-line object-cover transition-transform duration-150 active:scale-[0.97]"
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {lightbox && (
        <div
          className="absolute inset-0 z-lightbox flex animate-fade-in items-center justify-center bg-black/85 p-6"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="glass absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full text-ink"
            style={{ top: 'calc(env(safe-area-inset-top) + 16px)' }}
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            <X width={20} height={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Attire reference" className="max-h-full max-w-full rounded-[18px] object-contain" />
        </div>
      )}
      {song && <SongDetail song={song.song} context={song.context} onClose={() => setSong(null)} />}
      {onEdit && (
        <EventActions
          event={more ? event : null}
          onClose={() => setMore(false)}
          onEdit={(e) => {
            onClose();
            onEdit(e);
          }}
          onDeleted={() => (onDeleted ? onDeleted() : onClose())}
        />
      )}
      {openScripture && <ScriptureSheet reference={openScripture} onClose={() => setOpenScripture(null)} />}
    </Overlay>
  );
}
