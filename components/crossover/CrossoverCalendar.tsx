'use client';

import { useState } from 'react';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { useRouter } from 'next/navigation';
import type { EventDTO } from '@/lib/serialize';
import { EventCard } from '@/components/shared/EventCard';
import { EventDetail } from '@/components/shared/EventDetail';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Modal } from '@/components/shared/Modal';
import { Pencil, Plus, Trash } from '@/components/shared/Icons';
import { EventForm } from '@/components/leader/EventForm';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type FormState = { mode: 'create' } | { mode: 'edit'; event: EventDTO } | null;

const monthLabel = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });

/**
 * Every event in this Crossover season, month by month — past ones stay on the
 * list (dimmed) so the season reads as one story. Leaders add, edit and delete
 * here exactly as on Events; new events start tagged as a GNW Rehearsal.
 */
export function CrossoverCalendar({
  base,
  year,
  events,
  todayYmd,
  canManage,
}: {
  base: '/home' | '/dashboard';
  year: number;
  events: EventDTO[];
  todayYmd: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<EventDTO | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [confirming, setConfirming] = useState<EventDTO | null>(null);
  const [busy, setBusy] = useState(false);

  function saved() {
    setForm(null);
    router.refresh();
  }

  async function remove(scope: 'occurrence' | 'series' = 'occurrence') {
    if (!confirming) return;
    setBusy(true);
    try {
      await apiFetch(`/api/events/${confirming.id}${scope === 'series' ? '?scope=series' : ''}`, { method: 'DELETE' });
      setConfirming(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const months = events.reduce<{ label: string; list: EventDTO[] }[]>((acc, e) => {
    const label = monthLabel(e.date);
    const last = acc[acc.length - 1];
    if (last?.label === label) last.list.push(e);
    else acc.push({ label, list: [e] });
    return acc;
  }, []);

  return (
    <div className="space-y-5 pt-2">
      <ScreenHeader
        back={{ href: `${base}/crossover`, label: 'Crossover' }}
        eyebrow={`Crossover ${year}`}
        title="Calendar"
        className="mb-0"
        actions={
          <>
            {canManage && (
              <button type="button" className="btn-primary btn-sm h-11" onClick={() => setForm({ mode: 'create' })}>
                <Plus width={18} height={18} /> Add
              </button>
            )}
          </>
        }
      />
      <p className="-mt-2 text-sm text-ink-soft">
        Every Crossover rehearsal and event. They also show on the Events tab with a Crossover badge.
      </p>

      {events.length === 0 ? (
        <EmptyState message="No Crossover events yet." />
      ) : (
        <div className="space-y-6">
          {months.map(({ label, list }) => (
            <section key={label} className="space-y-3">
              <h2 className="eyebrow">{label}</h2>
              {list.map((event) => (
                <div key={event.id} className={cn('space-y-2', event.date.slice(0, 10) < todayYmd && 'opacity-60')}>
                  <EventCard event={event} onClick={() => setDetail(event)} />
                  {canManage && (
                    <div className="flex gap-2 px-1">
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => setForm({ mode: 'edit', event })}
                        type="button"
                      >
                        <Pencil width={15} height={15} /> Edit
                      </button>
                      <button
                        className="btn-ghost btn-sm text-bad-ink"
                        onClick={() => setConfirming(event)}
                        type="button"
                      >
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
        <EventForm mode="create" defaultCrossoverKind="gnw_rehearsal" onClose={() => setForm(null)} onSaved={saved} />
      )}
      {form?.mode === 'edit' && (
        <EventForm mode="edit" initial={form.event} onClose={() => setForm(null)} onSaved={saved} />
      )}

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
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-bad/15 px-5 py-3.5 font-semibold text-bad-ink transition active:scale-[0.97] disabled:opacity-40"
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
