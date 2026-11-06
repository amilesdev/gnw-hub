'use client';

import { useState } from 'react';
import type { EventDTO } from '@/lib/serialize';
import { ActionSheet } from './ActionSheet';
import { ConfirmDialog } from './ConfirmDialog';
import { Pencil } from './Icons';
import { apiFetch } from '@/lib/api-client';
import { formatEventDate } from '@/lib/dates';

/**
 * A leader's More menu for one event (CMP-23). One-offs: Edit / Delete (then
 * the usual confirm). Recurring: Edit / Delete this event only / Delete entire
 * series, which act directly — picking one is the confirmation, as before.
 */
export function EventActions({
  event,
  onClose,
  onEdit,
  onDeleted,
}: {
  event: EventDTO | null;
  onClose: () => void;
  onEdit: (e: EventDTO) => void;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState<EventDTO | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove(e: EventDTO, scope: 'occurrence' | 'series') {
    setBusy(true);
    try {
      const qs = scope === 'series' ? '?scope=series' : '';
      await apiFetch(`/api/events/${e.id}${qs}`, { method: 'DELETE' });
      setConfirming(null);
      onDeleted();
    } finally {
      setBusy(false);
    }
  }

  const recurring = !!event?.seriesId;
  const subtitle = event
    ? [formatEventDate(new Date(event.date)), event.repeats !== 'once' ? `Repeats ${event.repeats}` : null]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <>
      <ActionSheet
        open={!!event}
        onClose={onClose}
        title={event?.eventName ?? ''}
        subtitle={subtitle}
        actions={
          !event
            ? []
            : recurring
              ? [
                  { label: 'Edit event', icon: Pencil, onSelect: () => onEdit(event) },
                  { label: 'Delete this event only', tone: 'danger', onSelect: () => void remove(event, 'occurrence') },
                  { label: 'Delete entire series', tone: 'danger-soft', onSelect: () => void remove(event, 'series') },
                ]
              : [
                  { label: 'Edit event', icon: Pencil, onSelect: () => onEdit(event) },
                  { label: 'Delete event', tone: 'danger', onSelect: () => setConfirming(event) },
                ]
        }
      />
      <ConfirmDialog
        open={!!confirming}
        title="Delete event?"
        message="This permanently deletes the event."
        busy={busy}
        onConfirm={() => confirming && remove(confirming, 'occurrence')}
        onClose={() => setConfirming(null)}
      />
    </>
  );
}
