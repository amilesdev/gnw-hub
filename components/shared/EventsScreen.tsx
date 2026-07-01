'use client';

import { useEffect, useState } from 'react';
import type { EventDTO } from '@/lib/serialize';
import { EventCard } from './EventCard';
import { EventDetail } from './EventDetail';
import { EventsCalendar } from './EventsCalendar';
import { EmptyState } from './EmptyState';
import { EventCardSkeleton, SkeletonList } from './Skeleton';
import { ConfirmDialog } from './ConfirmDialog';
import { Modal } from './Modal';
import { Plus, Pencil, Trash } from './Icons';
import { EventForm } from '@/components/leader/EventForm';
import { apiFetch } from '@/lib/api-client';
import { formatEventDate } from '@/lib/dates';

type FormState = { mode: 'create' } | { mode: 'edit'; event: EventDTO } | null;

export function EventsScreen({ canManage }: { canManage: boolean }) {
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'month'>('list');
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [detail, setDetail] = useState<EventDTO | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [confirming, setConfirming] = useState<EventDTO | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { events } = await apiFetch<{ events: EventDTO[] }>('/api/events?scope=all');
      setEvents(events);
    } finally {
      setLoading(false);
    }
  }

  // Reload the list and signal the calendar to refetch its visible month.
  function refreshAll() {
    load();
    setRefreshSignal((n) => n + 1);
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(scope: 'occurrence' | 'series' = 'occurrence') {
    if (!confirming) return;
    setBusy(true);
    try {
      const qs = scope === 'series' ? '?scope=series' : '';
      await apiFetch(`/api/events/${confirming.id}${qs}`, { method: 'DELETE' });
      setConfirming(null);
      refreshAll();
    } finally {
      setBusy(false);
    }
  }

  // Group by calendar day for a clean timeline.
  const groups = events.reduce<Record<string, EventDTO[]>>((acc, e) => {
    const key = formatEventDate(new Date(e.date));
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-5 pt-2">
      <header className="flex items-end justify-between">
        <div>
          <div className="eyebrow">{canManage ? 'Leader tools' : 'GNW Hub'}</div>
          <h1 className="page-title mt-2">Events</h1>
        </div>
        {canManage && (
          <button type="button" className="btn-primary !px-4 !py-3" onClick={() => setForm({ mode: 'create' })}>
            <Plus width={18} height={18} /> Add
          </button>
        )}
      </header>

      {/* List / Month view toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
        {(['list', 'month'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={
              'rounded-xl py-2 text-sm font-semibold capitalize transition active:scale-[0.97] ' +
              (view === v ? 'bg-surface text-ink shadow-card' : 'text-ink-soft')
            }
          >
            {v === 'list' ? 'List' : 'Month'}
          </button>
        ))}
      </div>

      {view === 'month' ? (
        <EventsCalendar
          canManage={canManage}
          refreshSignal={refreshSignal}
          onOpen={(e) => setDetail(e)}
          onEdit={(e) => setForm({ mode: 'edit', event: e })}
          onDelete={(e) => setConfirming(e)}
        />
      ) : loading ? (
        <SkeletonList>
          <EventCardSkeleton />
          <EventCardSkeleton />
          <EventCardSkeleton />
        </SkeletonList>
      ) : events.length === 0 ? (
        <EmptyState message={canManage ? 'No upcoming events yet. Add one to get the team ready.' : 'No upcoming events right now. Rest up — more is coming.'} />
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([day, list]) => (
            <section key={day} className="space-y-3">
              <h2 className="eyebrow">{day}</h2>
              {list.map((event) => (
                <div key={event.id} className="space-y-2">
                  <EventCard event={event} onClick={() => setDetail(event)} />
                  {canManage && (
                    <div className="flex gap-2 px-1">
                      <button className="btn-ghost !py-2 text-sm" onClick={() => setForm({ mode: 'edit', event })} type="button">
                        <Pencil width={15} height={15} /> Edit
                      </button>
                      <button className="btn-ghost !py-2 text-sm text-bad" onClick={() => setConfirming(event)} type="button">
                        <Trash width={15} height={15} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {detail && <EventDetail event={detail} onClose={() => setDetail(null)} />}

      {form?.mode === 'create' && (
        <EventForm mode="create" onClose={() => setForm(null)} onSaved={() => { setForm(null); refreshAll(); }} />
      )}
      {form?.mode === 'edit' && (
        <EventForm mode="edit" initial={form.event} onClose={() => setForm(null)} onSaved={() => { setForm(null); refreshAll(); }} />
      )}

      {/* Recurring events get a scope choice; one-offs use the simple confirm. */}
      {confirming && confirming.seriesId ? (
        <Modal open title="Delete recurring event?" onClose={() => setConfirming(null)}>
          <p className="text-ink-soft">
            This is part of a repeating series. Delete just this date, or the whole series?
          </p>
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => remove('occurrence')}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-bad px-5 py-3.5 font-semibold text-white shadow-pop transition active:scale-[0.97] disabled:opacity-40"
            >
              {busy ? 'Working…' : 'This event only'}
            </button>
            <button
              type="button"
              onClick={() => remove('series')}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-bad/15 px-5 py-3.5 font-semibold text-bad transition active:scale-[0.97] disabled:opacity-40 dark:text-[#D98A84]"
            >
              {busy ? 'Working…' : 'Entire series'}
            </button>
            <button type="button" className="btn-ghost w-full" onClick={() => setConfirming(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </Modal>
      ) : (
        <ConfirmDialog
          open={!!confirming}
          title="Delete event?"
          message="This permanently deletes the event."
          busy={busy}
          onConfirm={() => remove('occurrence')}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
