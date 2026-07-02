'use client';

import { useState } from 'react';
import type { AnnouncementDTO } from '@/lib/serialize';
import { Modal } from '@/components/shared/Modal';
import { TextField, TextArea } from '@/components/shared/Field';
import { Switch } from '@/components/shared/Switch';
import { Bell } from '@/components/shared/Icons';
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
  // Whether to also push this as a notification. Only offered on a new post
  // (re-pushing an edit would re-alert everyone); opt-in, off by default.
  const [notify, setNotify] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError('Title is required.');
    setBusy(true);
    const payload = { title, body, expiresAt: new Date(expiresAt).toISOString() };
    try {
      if (initial) {
        await apiFetch(`/api/announcements/${initial.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await apiFetch('/api/announcements', { method: 'POST', body: JSON.stringify({ ...payload, notify }) });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={initial ? 'Edit announcement' : 'New Update'}>
      <form onSubmit={submit} className="space-y-4">
        <TextField
          label="Title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Rehearsal moved"
          enterKeyHint="next"
        />
        <TextArea label="Body (optional)" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share the details…" />
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
        </div>
        {!initial && (
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
            <span className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface text-accent dark:text-accent-on">
                <Bell width={18} height={18} />
              </span>
              <span>
                <span className="block font-semibold">Send as notification</span>
                <span className="block text-xs text-ink-faint">Push to everyone with alerts on.</span>
              </span>
            </span>
            <Switch checked={notify} onChange={setNotify} aria-label="Send as notification" />
          </label>
        )}
        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Post announcement'}
        </button>
      </form>
    </Modal>
  );
}
