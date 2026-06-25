'use client';

import { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { TextField, TextArea } from '@/components/shared/Field';
import { Check } from '@/components/shared/Icons';
import { apiFetch } from '@/lib/api-client';

type SendResult = { ok: boolean; sent: number; skipped: boolean };

/**
 * Leader-only composer to manually push a notification to the whole team.
 * Shows how many devices it reached so you can confirm delivery while testing.
 */
export function PushComposer({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !body.trim()) return setError('Title and message are required.');
    setBusy(true);
    try {
      const res = await apiFetch<SendResult>('/api/push/send', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Send notification">
      {result ? (
        <div className="space-y-4">
          <p className="inline-flex items-center gap-1.5 font-semibold text-good">
            <Check width={18} height={18} /> Sent.
          </p>
          <p className="text-sm text-ink-soft">
            {result.skipped
              ? 'Push isn’t configured on the server yet — add the VAPID keys to your hosting environment.'
              : result.sent === 0
                ? 'No devices are subscribed yet. Have team members turn on notifications from their Profile.'
                : `Delivered to ${result.sent} device${result.sent > 1 ? 's' : ''}.`}
          </p>
          <button type="button" className="btn-primary w-full" onClick={onClose}>
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <TextField
            label="Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Rehearsal tonight"
          />
          <TextArea
            label="Message"
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="We’re still on for 7pm — see you there!"
          />
          <p className="text-xs text-ink-faint">
            Goes to every team member who has notifications turned on. Tapping it opens the app.
          </p>
          {error && <p className="text-sm font-semibold text-bad">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Sending…' : 'Send to team'}
          </button>
        </form>
      )}
    </Modal>
  );
}
