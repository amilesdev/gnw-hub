'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/shared/Modal';
import { TextField } from '@/components/shared/Field';
import { apiFetch } from '@/lib/api-client';
import type { CallDTO } from '@/lib/serialize';

// Cycled through the name field's placeholder as gentle examples.
const PLACEHOLDERS = ['Prayer Call', 'Quick Check-In', 'Rehearsal Sync', 'Team Huddle'];

export function StartCallModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Rotate the placeholder examples while the field is empty.
  useEffect(() => {
    const t = setInterval(() => {
      setPlaceholder((p) => PLACEHOLDERS[(PLACEHOLDERS.indexOf(p) + 1) % PLACEHOLDERS.length]);
    }, 2200);
    return () => clearInterval(t);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Give the call a name.');
    setBusy(true);
    try {
      const { call } = await apiFetch<{ call: CallDTO }>('/api/calls', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      // Hand off to the call page, which requests its own token and connects.
      router.push(`/call/${call.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the call.');
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Start a call">
      <form onSubmit={submit} className="space-y-4">
        <TextField
          label="Call name"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          enterKeyHint="go"
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled
            title="Coming soon"
            aria-disabled="true"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 font-semibold text-ink-faint opacity-60"
          >
            Invite
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={busy || !name.trim()}>
            {busy ? 'Starting…' : 'Start Call'}
          </button>
        </div>

        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
      </form>
    </Modal>
  );
}
