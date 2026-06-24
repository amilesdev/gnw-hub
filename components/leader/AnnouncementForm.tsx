'use client';

import { useState } from 'react';
import type { AnnouncementDTO } from '@/lib/serialize';
import { Modal } from '@/components/shared/Modal';
import { TextField, TextArea } from '@/components/shared/Field';
import { apiFetch } from '@/lib/api-client';
import { defaultExpiry, maxExpiry, minExpiry, toLocalInput, ANNOUNCEMENT_MAX_DAYS } from '@/lib/announcement-ui';

export function AnnouncementForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: AnnouncementDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [expiresAt, setExpiresAt] = useState(initial ? toLocalInput(new Date(initial.expiresAt)) : defaultExpiry());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !body.trim()) return setError('Title and body are required.');
    setBusy(true);
    const payload = { title, body, expiresAt: new Date(expiresAt).toISOString() };
    try {
      if (initial) {
        await apiFetch(`/api/announcements/${initial.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await apiFetch('/api/announcements', { method: 'POST', body: JSON.stringify(payload) });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={initial ? 'Edit announcement' : 'New announcement'}>
      <form onSubmit={submit} className="space-y-4">
        <TextField label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Rehearsal moved" />
        <TextArea label="Body" required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share the details…" />
        <div className="min-w-0">
          <TextField
            label={`Expires (max ${ANNOUNCEMENT_MAX_DAYS} days out)`}
            type="datetime-local"
            required
            value={expiresAt}
            min={minExpiry()}
            max={maxExpiry()}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
          <p className="mt-1 text-xs text-ink-faint">It auto-hides after this time — no cleanup needed.</p>
        </div>
        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Post announcement'}
        </button>
      </form>
    </Modal>
  );
}
