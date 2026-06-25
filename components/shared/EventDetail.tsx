'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { EventDTO, PrayerRequestDTO } from '@/lib/serialize';
import type { SetlistDTO, SongDTO } from '@/lib/setlist-serialize';
import { Overlay } from './Overlay';
import { SongDetail } from './SongDetail';
import { EventTypeBadge } from './EventTypeBadge';
import { hasAttire } from './EventCard';
import { Calendar, Clock, MapPin, Shirt, Book, Music, Pray, Trash, ChevronRight, X } from './Icons';
import { apiFetch } from '@/lib/api-client';
import { formatEventDate, formatTimeLabel } from '@/lib/dates';

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-soft">{icon}</span>
      <span className="text-ink">{children}</span>
    </div>
  );
}

function ColorSwatch({ label, name, hex }: { label: string; name?: string | null; hex?: string | null }) {
  if (!name && !hex) return null;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className="grid h-14 w-14 place-items-center rounded-2xl border border-line text-ink-faint shadow-card"
        style={hex ? { background: hex } : undefined}
        aria-hidden
      >
        {!hex && <Shirt width={18} height={18} />}
      </span>
      <span className="label">{label}</span>
      {name && <span className="text-xs font-semibold text-ink-soft">{name}</span>}
      {hex && <span className="text-[11px] font-semibold uppercase text-ink-faint">{hex}</span>}
    </div>
  );
}

function formatRequestDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

  async function remove(id: string) {
    const prev = requests;
    setRequests((r) => r.filter((x) => x.id !== id)); // optimistic
    try {
      await apiFetch(`/api/events/${eventId}/prayer-requests/${id}`, { method: 'DELETE' });
    } catch {
      setRequests(prev); // restore on failure
    }
  }

  return (
    <section className="card grain-block space-y-4 p-4">
      <p className="eyebrow inline-flex items-center gap-1.5">
        <Pray width={14} height={14} /> Prayer Requests
      </p>

      <figure className="rounded-2xl bg-surface-2 px-4 py-4 text-center">
        <blockquote className="font-display text-[15px] italic leading-snug text-ink-soft">
          “Therefore, I tell you, whatever you ask in prayer, believe that you have received it, and it
          will be yours.”
        </blockquote>
        <figcaption className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
          Mark 11:24
        </figcaption>
      </figure>

      {!loading && requests.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {requests.map((r) => {
            const canDelete = me && (me.id === r.authorId || me.role === 'leader');
            return (
              <li key={r.id} className="flex items-start gap-3 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-[15px] text-ink">{r.body}</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    <span className="font-semibold text-ink-soft">{r.authorName}</span>
                    {' · '}
                    {formatRequestDate(r.createdAt)}
                  </p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    aria-label="Remove prayer request"
                    className="shrink-0 text-ink-faint transition hover:text-bad"
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
          No requests yet — be the first to share one.
        </p>
      )}

      <form onSubmit={add} className="space-y-2">
        <textarea
          className="field min-h-[44px]"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Share a prayer request for the team…"
          maxLength={2000}
        />
        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy || !draft.trim()}>
          {busy ? 'Sharing…' : 'Add prayer request'}
        </button>
      </form>
    </section>
  );
}

export function EventDetail({ event, onClose }: { event: EventDTO; onClose: () => void }) {
  const [setlist, setSetlist] = useState<SetlistDTO | null>(null);
  const [song, setSong] = useState<SongDTO | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const isHolyTalks = event.type === 'holy_talks';
  const isPrayer = event.type === 'prayer';

  // Pull in the setlist tied to this event (if any) so it lives on the card.
  useEffect(() => {
    let active = true;
    apiFetch<{ setlists: SetlistDTO[] }>(`/api/setlists?eventId=${event.id}`)
      .then(({ setlists }) => {
        if (active) setSetlist(setlists.find((s) => s.songs.length > 0) ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [event.id]);

  return (
    <Overlay title={event.eventName} onClose={onClose} action={<EventTypeBadge type={event.type} />}>
      <div className="space-y-5">
        <section className="card divide-y divide-line px-4 py-1">
          <InfoRow icon={<Calendar width={18} height={18} />}>{formatEventDate(new Date(event.date))}</InfoRow>
          <InfoRow icon={<Clock width={18} height={18} />}>{formatTimeLabel(event.time)}</InfoRow>
          <InfoRow icon={<MapPin width={18} height={18} />}>{event.location}</InfoRow>
        </section>

        {setlist && setlist.songs.length > 0 && (
          <section className="space-y-2.5">
            <p className="eyebrow inline-flex items-center gap-1.5">
              <Music width={14} height={14} /> Setlist · {setlist.songs.length} song{setlist.songs.length === 1 ? '' : 's'}
            </p>
            <ol className="space-y-2.5">
              {setlist.songs.map((s, i) => {
                const partCount = [s.audioSoprano, s.audioAlto, s.audioTenor, s.audioAllParts].filter(Boolean).length;
                return (
                  <li
                    key={s.id}
                    className="animate-rise"
                    style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
                  >
                    <button
                      type="button"
                      onClick={() => setSong(s)}
                      className="card row-press flex w-full items-center gap-3 p-4 text-left"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 font-display font-semibold text-accent-ink">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{s.songTitle}</span>
                        <span className="flex items-center gap-1 text-xs text-ink-faint">
                          <Music width={12} height={12} />
                          {partCount > 0 ? `${partCount} part${partCount > 1 ? 's' : ''} available` : 'Audio coming soon'}
                        </span>
                      </span>
                      <ChevronRight width={20} height={20} className="text-ink-faint" />
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {event.notes && (
          <section className="card p-4">
            <p className="label mb-1.5">Notes</p>
            <p className="whitespace-pre-wrap text-ink-soft">{event.notes}</p>
          </section>
        )}

        {isPrayer && <PrayerRequests eventId={event.id} />}

        {isHolyTalks && (event.topic || event.scriptures.length > 0 || event.holyTalksNotes) && (
          <section className="card p-4">
            <p className="eyebrow mb-3 inline-flex items-center gap-1.5">
              <Book width={14} height={14} /> Holy Talks
            </p>
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
                    <li key={i} className="chip bg-accent/10 text-accent-ink dark:text-accent-on">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {event.holyTalksNotes && (
              <div>
                <p className="label mb-1">Notes</p>
                <p className="whitespace-pre-wrap text-ink-soft">{event.holyTalksNotes}</p>
              </div>
            )}
          </section>
        )}

        {hasAttire(event) && (
          <section className="card grain-block space-y-4 p-4">
            <p className="eyebrow inline-flex items-center gap-1.5">
              <Shirt width={14} height={14} /> What to wear
            </p>

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
                <p className="whitespace-pre-wrap text-ink-soft">{event.attireNotes}</p>
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
                      className="row-press aspect-square w-full cursor-zoom-in rounded-2xl border border-line object-cover"
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
          className="absolute inset-0 z-[60] flex animate-fade-in items-center justify-center bg-ink/80 p-6"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute right-5 top-5 text-white" onClick={() => setLightbox(null)} aria-label="Close">
            <X width={26} height={26} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Attire reference" className="max-h-full max-w-full rounded-2xl object-contain" />
        </div>
      )}
      {song && <SongDetail song={song} onClose={() => setSong(null)} />}
    </Overlay>
  );
}
